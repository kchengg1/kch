import type { Metadata } from "next";
import { Badge, Button, Card, CardDescription, CardTitle, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { dueLabel } from "@/components/credit-row";
import { OfferPaste } from "@/components/offer-paste";
import { formatCents } from "@/lib/money";
import { groupOffers, merchantKey } from "@/lib/offer-groups";
import { offerReturn, rateLabel, WEAK_RATE } from "@/lib/offer-value";
import {
  dateOf,
  listHiddenMerchants,
  listOffers,
  loadPortfolio,
  today as getToday,
} from "@/lib/perks";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import {
  deleteOfferAction,
  hideMerchantAction,
  saveOffersAction,
  setOfferStatusAction,
  setOffersStatusAction,
  unhideMerchantAction,
} from "../actions";

export const metadata: Metadata = { title: "Offers" };

const SORTS = {
  return: "Best return",
  value: "Biggest reward",
  expiry: "Expiring soonest",
} as const;
type Sort = keyof typeof SORTS;

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { user } = await requireSession();
  const today = getToday();
  const { sort: sortParam } = await searchParams;
  const sort: Sort = sortParam && sortParam in SORTS ? (sortParam as Sort) : "return";
  const [{ cards }, offers, hidden] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
    listHiddenMerchants(user.id),
  ]);
  const hiddenKeys = new Set(hidden.map((h) => h.merchantKey));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  /** Offers older than this are probably out of date: banks rotate them every few weeks. */
  const STALE_DAYS = 14;
  const checked = (c: (typeof cards)[number]) => {
    if (!c.offersCheckedAt) return { text: "never pasted", stale: true };
    const date = dateOf(c.offersCheckedAt);
    const ago = daysBetween(date, today);
    const when = ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
    return { text: `updated ${when} (${formatDate(date, today)})`, stale: ago > STALE_DAYS };
  };
  // Amex and Chase run the offer programs, so list those cards first.
  const openCards = cards
    .filter((c) => !c.closed)
    .sort(
      (a, b) =>
        Number(/american express|chase/i.test(b.issuer)) -
          Number(/american express|chase/i.test(a.issuer)) || a.name.localeCompare(b.name),
    );

  // Amex and Chase run card-linked offers; also list any card offers were pasted for.
  const offerCards = openCards.filter(
    (c) => /american express|chase/i.test(c.issuer) || c.offersCheckedAt,
  );

  const expired = (o: (typeof offers)[number]) => o.expiresOn !== null && o.expiresOn < today;
  const live = offers.filter(
    (o) =>
      (o.status === "available" || o.status === "added") &&
      !expired(o) &&
      !hiddenKeys.has(merchantKey(o.merchant)),
  );
  const past = offers.filter(
    (o) => !(o.status === "available" || o.status === "added") || expired(o),
  );

  const scored = groupOffers(live).map((g) => {
    const ret = offerReturn(g.details);
    return { ...g, rate: ret?.rate ?? null, maxCents: ret?.maxCents ?? g.valueCents };
  });
  type Scored = (typeof scored)[number];
  const byExpiry = (a: Scored, b: Scored) =>
    (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999");
  const compare: Record<Sort, (a: Scored, b: Scored) => number> = {
    // Offers the text can't be scored from go last, not first.
    return: (a, b) => (b.rate ?? -1) - (a.rate ?? -1) || byExpiry(a, b),
    value: (a, b) => (b.maxCents ?? -1) - (a.maxCents ?? -1) || byExpiry(a, b),
    expiry: (a, b) => byExpiry(a, b) || (b.rate ?? -1) - (a.rate ?? -1),
  };
  const sorted = [...scored].sort(compare[sort]);
  const isWeak = (g: Scored) => g.rate !== null && g.rate < WEAK_RATE;
  const strong = sorted.filter((g) => !isWeak(g));
  const weak = sorted.filter(isWeak);
  const strongValue = strong.reduce((n, g) => n + (g.maxCents ?? 0), 0);

  const row = (g: Scored) => {
    const days = g.expiresOn ? daysBetween(today, g.expiresOn) : null;
    const ids = g.items.map((o) => o.id);
    return (
      <li
        key={g.key}
        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {g.merchant}
            {g.rate !== null && (
              <Badge variant={g.rate >= 0.5 ? "success" : isWeak(g) ? "secondary" : "outline"}>
                {rateLabel(g.rate)}
              </Badge>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {g.details || "Added to card. See your issuer's site for the deal."}
          </p>
          <p className="text-sm text-muted-foreground">
            {g.maxCents !== null && `Up to ${formatCents(g.maxCents)} · `}
            {g.expiresOn ? `Expires ${formatDate(g.expiresOn, today)}` : "No expiry saved"}
            {days !== null && (
              <span className={days <= 7 ? "font-medium text-destructive" : undefined}>
                {" · "}
                {dueLabel(days)}
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.items.map((o) => {
              const card = o.cardId ? cardById.get(o.cardId) : undefined;
              const added = o.status === "added";
              return (
                <form
                  key={o.id}
                  action={setOfferStatusAction.bind(null, o.id, added ? "available" : "added")}
                >
                  <button
                    type="submit"
                    aria-pressed={added}
                    title={
                      added
                        ? `Added on ${card?.name ?? "this card"}. Tap to undo.`
                        : `Not added on ${card?.name ?? "this card"} yet. Tap once you add it.`
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      added
                        ? "border-success/40 bg-success/10 text-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <CardIcon
                      templateKey={card?.templateKey}
                      issuer={card?.issuer}
                      className="h-3 w-[19px]"
                    />
                    {card?.name ?? "Any card"}
                    <span>{added ? "✓ added" : "not added"}</span>
                  </button>
                </form>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <form action={setOffersStatusAction.bind(null, ids, "used")}>
            <Button type="submit" size="sm">
              Used
            </Button>
          </form>
          <form action={setOffersStatusAction.bind(null, ids, "dismissed")}>
            <Button type="submit" size="sm" variant="ghost">
              Skip
            </Button>
          </form>
          <form action={hideMerchantAction.bind(null, g.merchant)}>
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              title={`Hide every ${g.merchant} offer, now and in future pastes`}
            >
              Not interested
            </Button>
          </form>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="text-muted-foreground">
          {scored.length === 0
            ? "Amex Offers and Chase Offers you have saved show up here with their expiry dates."
            : `${strong.length} worthwhile offer${strong.length === 1 ? "" : "s"}, up to ${formatCents(strongValue)} back in total. Offers on several cards are shown once.`}
        </p>
      </div>

      {offerCards.length > 0 && (
        <Card className="py-2">
          <p className="pt-2 text-sm font-medium">Last pasted</p>
          <ul className="divide-y text-sm">
            {offerCards.map((c) => {
              const status = checked(c);
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <CardIcon templateKey={c.templateKey} issuer={c.issuer} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span
                    className={
                      status.stale
                        ? "shrink-0 font-medium text-destructive"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {status.text}
                    {status.stale && c.offersCheckedAt ? ", may be out of date" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {scored.length > 0 && (
        <section className="space-y-3">
          <nav aria-label="Sort offers" className="flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-muted-foreground">Sort by</span>
            {(Object.keys(SORTS) as Sort[]).map((k) => (
              <a
                key={k}
                href={k === "return" ? "/dashboard/offers" : `/dashboard/offers?sort=${k}`}
                aria-current={sort === k ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1",
                  sort === k
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {SORTS[k]}
              </a>
            ))}
          </nav>
          {strong.length > 0 && (
            <Card className="py-2">
              <ul className="divide-y">{strong.map(row)}</ul>
            </Card>
          )}
          {weak.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                {weak.length} weaker offer{weak.length === 1 ? "" : "s"}, under{" "}
                {Math.round(WEAK_RATE * 100)}% back
              </summary>
              <Card className="mt-3 py-2">
                <ul className="divide-y">{weak.map(row)}</ul>
              </Card>
            </details>
          )}
        </section>
      )}

      <Card className="max-w-3xl">
        <CardTitle>Add offers</CardTitle>
        <CardDescription className="mt-1">
          Amex and Chase do not let apps read your offers, so bring them in by copy and paste. Open
          the offers page for one card, select the whole page (Ctrl/Cmd + A), copy, and paste below.
          Offers you already saved are skipped, so pasting the same page again is safe.
        </CardDescription>
        <div className="mt-4">
          <OfferPaste
            action={saveOffersAction}
            cards={openCards.map((c) => ({ id: c.id, name: c.name, checked: checked(c).text }))}
            today={today}
            hiddenKeys={[...hiddenKeys]}
          />
        </div>
      </Card>

      {hidden.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {hidden.length} merchant{hidden.length === 1 ? "" : "s"} you marked not interested
          </summary>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {hidden.map((h) => (
                <li key={h.merchantKey} className="flex items-center justify-between gap-4 py-2.5">
                  <span>{h.label}</span>
                  <form action={unhideMerchantAction.bind(null, h.merchantKey)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Show again
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {past.length} used, skipped or expired
          </summary>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {past.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span>
                    {o.merchant}{" "}
                    {o.details && <span className="text-muted-foreground">· {o.details}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {o.status === "used"
                        ? "Used"
                        : o.status === "dismissed"
                          ? "Skipped"
                          : "Expired"}
                    </Badge>
                    <form action={deleteOfferAction.bind(null, o.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { dueLabel } from "@/components/credit-row";
import { OfferPaste, PasteJumpLink } from "@/components/offer-paste";
import { SwipeRow, SwipeUndoProvider } from "@/components/offer-swipe";
import { formatCents } from "@/lib/money";
import {
  isOfferCategory,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABEL,
  OFFER_CATEGORY_ORDER,
  offerCategory,
  type OfferCategory,
} from "@/lib/offer-category";
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
  category: "Category",
} as const;
type Sort = keyof typeof SORTS;

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; cat?: string }>;
}) {
  const { user } = await requireSession();
  const today = getToday();
  const { sort: sortParam, cat: catParam } = await searchParams;
  const sort: Sort = sortParam && sortParam in SORTS ? (sortParam as Sort) : "return";
  const activeCat: OfferCategory | null = isOfferCategory(catParam) ? catParam : null;
  const offersHref = (nextSort: Sort, nextCat: OfferCategory | null) => {
    const q = new URLSearchParams();
    if (nextSort !== "return") q.set("sort", nextSort);
    if (nextCat) q.set("cat", nextCat);
    const qs = q.toString();
    return qs ? `/dashboard/offers?${qs}` : "/dashboard/offers";
  };
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
    (o) =>
      o.status !== "hidden" && (!(o.status === "available" || o.status === "added") || expired(o)),
  );

  const scored = groupOffers(live).map((g) => {
    const ret = offerReturn(g.details);
    return {
      ...g,
      category: offerCategory(g.merchant, g.details),
      rate: ret?.rate ?? null,
      maxCents: ret?.maxCents ?? g.valueCents,
    };
  });
  type Scored = (typeof scored)[number];
  const byExpiry = (a: Scored, b: Scored) =>
    (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999");
  const byReturn = (a: Scored, b: Scored) => (b.rate ?? -1) - (a.rate ?? -1) || byExpiry(a, b);
  const compare: Record<Sort, (a: Scored, b: Scored) => number> = {
    // Offers the text can't be scored from go last, not first.
    return: byReturn,
    value: (a, b) => (b.maxCents ?? -1) - (a.maxCents ?? -1) || byExpiry(a, b),
    expiry: (a, b) => byExpiry(a, b) || (b.rate ?? -1) - (a.rate ?? -1),
    category: (a, b) =>
      OFFER_CATEGORY_ORDER[a.category] - OFFER_CATEGORY_ORDER[b.category] || byReturn(a, b),
  };
  const categoryCounts = new Map<OfferCategory, number>();
  for (const g of scored) {
    categoryCounts.set(g.category, (categoryCounts.get(g.category) ?? 0) + 1);
  }
  const visibleCategories = OFFER_CATEGORIES.filter(
    (c) => (categoryCounts.get(c.id) ?? 0) > 0 || c.id === activeCat,
  );
  const sorted = [...scored].sort(compare[sort]);
  const isWeak = (g: Scored) => g.rate !== null && g.rate < WEAK_RATE;
  const allStrong = sorted.filter((g) => !isWeak(g));
  const allStrongValue = allStrong.reduce((n, g) => n + (g.maxCents ?? 0), 0);
  const filtered = activeCat ? sorted.filter((g) => g.category === activeCat) : sorted;
  const strong = filtered.filter((g) => !isWeak(g));
  const weak = filtered.filter(isWeak);
  const strongByCategory =
    sort === "category" && !activeCat
      ? OFFER_CATEGORIES.map((c) => ({
          ...c,
          items: strong.filter((g) => g.category === c.id),
        })).filter((c) => c.items.length > 0)
      : null;

  const row = (g: Scored) => {
    const days = g.expiresOn ? daysBetween(today, g.expiresOn) : null;
    const ids = g.items.map((o) => o.id);
    const showCatLabel = !activeCat && sort !== "category" && g.category !== "other";
    return (
      <SwipeRow
        key={g.key}
        merchant={g.merchant}
        items={g.items.map((o) => ({ id: o.id, status: o.status }))}
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
            {showCatLabel && `${OFFER_CATEGORY_LABEL[g.category]} · `}
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
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:min-h-0 sm:px-2.5",
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
      </SwipeRow>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="text-muted-foreground">
          {scored.length === 0
            ? "Amex Offers and Chase Offers you have saved show up here with their expiry dates."
            : `${allStrong.length} worthwhile offer${allStrong.length === 1 ? "" : "s"}, up to ${formatCents(allStrongValue)} back in total. Offers on several cards are shown once.`}
        </p>
      </div>

      {offerCards.length > 0 && (
        <Card className="py-2">
          <div className="flex items-baseline justify-between gap-2 pt-2">
            <p className="text-sm font-medium">Last pasted</p>
            <p className="text-xs text-muted-foreground">Click a card to paste</p>
          </div>
          <ul className="divide-y text-sm">
            {offerCards.map((c) => {
              const status = checked(c);
              return (
                <li key={c.id}>
                  <PasteJumpLink
                    cardId={c.id}
                    cardName={c.name}
                    className="group -mx-2 flex items-center justify-between gap-4 rounded-[var(--radius)] px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <CardIcon templateKey={c.templateKey} issuer={c.issuer} />
                      <span className="truncate group-hover:text-primary">{c.name}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <span
                        className={
                          status.stale ? "font-medium text-destructive" : "text-muted-foreground"
                        }
                      >
                        {status.text}
                        {status.stale && c.offersCheckedAt ? ", may be out of date" : ""}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </span>
                  </PasteJumpLink>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {scored.length > 0 && (
        <SwipeUndoProvider>
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground sm:hidden">
              Swipe an offer left to skip it, or right once you&rsquo;ve used it.
            </p>
            <div className="space-y-2">
              <nav
                aria-label="Sort offers"
                className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <span className="mr-1 text-muted-foreground">Sort by</span>
                {(Object.keys(SORTS) as Sort[]).map((k) => (
                  <a
                    key={k}
                    href={offersHref(k, activeCat)}
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
              {visibleCategories.length > 1 && (
                <nav
                  aria-label="Filter offers by category"
                  className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:flex-wrap sm:px-0"
                >
                  <span className="mr-1 text-muted-foreground">Category</span>
                  <a
                    href={offersHref(sort, null)}
                    aria-current={!activeCat ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      !activeCat
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    All ({scored.length})
                  </a>
                  {visibleCategories.map((c) => {
                    const count = categoryCounts.get(c.id) ?? 0;
                    const active = activeCat === c.id;
                    return (
                      <a
                        key={c.id}
                        href={offersHref(sort, active ? null : c.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {c.label} ({count})
                      </a>
                    );
                  })}
                </nav>
              )}
            </div>
            {strongByCategory ? (
              <div className="space-y-4">
                {strongByCategory.map((group) => (
                  <Card key={group.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-2 pt-2">
                      <p className="text-sm font-medium">{group.label}</p>
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </div>
                    <ul className="divide-y">{group.items.map(row)}</ul>
                  </Card>
                ))}
              </div>
            ) : strong.length > 0 ? (
              <Card className="py-2">
                <ul className="divide-y">{strong.map(row)}</ul>
              </Card>
            ) : activeCat && weak.length === 0 ? (
              <Card>
                <p className="text-sm text-muted-foreground">
                  No {OFFER_CATEGORY_LABEL[activeCat].toLowerCase()} offers right now.{" "}
                  <a href={offersHref(sort, null)} className="font-medium text-primary underline">
                    Show all offers
                  </a>
                </p>
              </Card>
            ) : null}
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
        </SwipeUndoProvider>
      )}

      <Card id="add-offers" className="max-w-3xl scroll-mt-20">
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

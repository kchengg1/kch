import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, Input, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { CATEGORIES, EARN_REVIEWED, classify, rankCards } from "@/lib/earn";
import { merchantKey } from "@/lib/offer-groups";
import { listOffers, listPoints, loadPortfolio, today as getToday } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import { defaultCentsPerPoint, formatCpp } from "@/lib/points";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Which card?" };

const fmtX = (x: number) => `${Number(x.toFixed(1))}x`;

export default async function PickPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user } = await requireSession();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const today = getToday();
  const [{ cards }, points, offers] = await Promise.all([
    loadPortfolio(user.id),
    listPoints(user.id),
    listOffers(user.id),
  ]);
  const myValue = new Map(points.map((p) => [p.program, p.centsPerPointX100 / 100]));
  const valueOf = (program: string) => myValue.get(program) ?? defaultCentsPerPoint(program);
  const target = query ? classify(query) : null;
  const picks = target ? rankCards(cards, target, valueOf) : [];
  const categoryLabel = target ? CATEGORIES.find((c) => c.id === target.category)!.label : "";

  // Saved offers at this merchant, when the search is a merchant rather than a category.
  const isCategoryWord = CATEGORIES.some((c) => c.label.toLowerCase() === query.toLowerCase());
  const key = merchantKey(query);
  const offerHits =
    query && !isCategoryWord && key.length >= 3
      ? offers.filter((o) => {
          const m = merchantKey(o.merchant);
          return (
            (o.status === "available" || o.status === "added") &&
            !(o.expiresOn && o.expiresOn < today) &&
            (m.includes(key) || key.includes(m.split(" ")[0]!))
          );
        })
      : [];
  const offerCards = new Set(offerHits.map((o) => o.cardId));
  const unknownCards = cards.filter((c) => !c.closed && !c.templateKey);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Which card should I use?</h1>
        <p className="text-muted-foreground">
          Type a store or pick a category. Cards are ranked by points earned times your own point
          values.
        </p>
      </div>

      <form action="/dashboard/pick" className="flex gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Whole Foods, Hyatt, gas…"
          aria-label="Store or category"
          className="h-11"
          autoFocus={!query}
        />
        <Button type="submit" className="h-11">
          Check
        </Button>
      </form>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/pick?q=${encodeURIComponent(c.label)}` as never}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              target?.category === c.id && isCategoryWord
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "bg-card hover:bg-muted",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {query && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isCategoryWord ? categoryLabel : `“${query}” counts as ${categoryLabel.toLowerCase()}`}
            {target?.chain ? `, at ${target.chain[0]!.toUpperCase()}${target.chain.slice(1)}` : ""}.
          </p>

          {offerHits.length > 0 && (
            <Card className="border-success/40 bg-success/5 py-3">
              <p className="font-medium">
                You have {offerHits.length === 1 ? "an offer" : "offers"} here
              </p>
              <ul className="mt-1 text-sm">
                {offerHits.map((o) => (
                  <li key={o.id}>
                    {o.merchant}: {o.details || "added to card"}
                    {o.cardId && ` · ${cards.find((c) => c.id === o.cardId)?.name ?? ""}`}
                    {o.status === "available" && " · not added yet"}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {picks.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                None of your open cards are in the catalog yet, so there are no earn rates to
                compare.
              </p>
            </Card>
          ) : (
            <Card className="py-2">
              <ol className="divide-y">
                {picks.map((p, i) => (
                  <li key={p.cardId} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <CardIcon templateKey={p.templateKey} issuer={p.issuer} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {p.cardName}
                          {i === 0 && <Badge variant="success">Best</Badge>}
                          {offerCards.has(p.cardId) && (
                            <Badge variant="outline">Has an offer</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {fmtX(p.x)}
                          {p.currency === "Cash back"
                            ? " (cash back)"
                            : ` ${p.currency} at ${formatCpp(p.centsPerPoint)}`}
                          {p.note && ` · ${p.note}`}
                        </p>
                        {p.rotating && (
                          <p className="text-sm text-muted-foreground">
                            Could be 5% if it&rsquo;s in this quarter&rsquo;s categories.
                          </p>
                        )}
                        {p.portal && ["flights", "hotels", "travel"].includes(target!.category) && (
                          <p className="text-sm text-muted-foreground">Tip: {p.portal}.</p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums">
                      {p.returnPct}%
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {unknownCards.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Not ranked, no earn rates on file: {unknownCards.map((c) => c.name).join(", ")}.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Earn rates as of {formatDate(EARN_REVIEWED)}. Point values come from your Points tab.
          </p>
        </section>
      )}
    </div>
  );
}

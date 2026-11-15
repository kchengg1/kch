import type { Metadata } from "next";
import { Badge, Card, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { dueLabel } from "@/components/credit-row";
import { formatCents } from "@/lib/money";
import { merchantKey } from "@/lib/offer-groups";
import { rateLabel, WEAK_RATE } from "@/lib/offer-value";
import { listEveryonesOffers, today as getToday } from "@/lib/perks";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { liveMerchantKeys, offersByPerson } from "@/lib/shared-offers";

export const metadata: Metadata = { title: "People" };

/** Read-only view of the Amex and Chase offers everyone else in the group has saved. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { user } = await requireSession();
  const today = getToday();
  const { p } = await searchParams;
  const { people, offers, cards } = await listEveryonesOffers();
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const everyone = offersByPerson(people, offers, user.id, today);
  const mine = liveMerchantKeys(
    offers.filter((o) => o.userId === user.id),
    today,
  );
  const person = everyone.find((x) => x.id === p) ?? everyone[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-muted-foreground">
          Amex Offers and Chase Offers others in the group have saved. Offers are targeted, so a
          deal here may not be on your cards.
        </p>
      </div>

      {!person ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Nobody else has saved offers yet. Once someone pastes their offers page, it shows up
            here.
          </p>
        </Card>
      ) : (
        <>
          <nav
            aria-label="Choose a person"
            className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {everyone.map((x) => (
              <a
                key={x.id}
                href={`/dashboard/people?p=${encodeURIComponent(x.id)}`}
                aria-current={x.id === person.id ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1",
                  x.id === person.id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {x.firstName} <span className="text-xs opacity-70">{x.groups.length}</span>
              </a>
            ))}
          </nav>

          <section className="space-y-3">
            <h2 className="font-semibold">
              {person.firstName}&rsquo;s offers{" "}
              <span className="font-normal text-muted-foreground">
                · {person.groups.length} live
              </span>
            </h2>
            <Card className="py-2">
              <ul className="divide-y">
                {person.groups.map((g) => {
                  const days = g.expiresOn ? daysBetween(today, g.expiresOn) : null;
                  const weak = g.rate !== null && g.rate < WEAK_RATE;
                  const missing = !mine.has(merchantKey(g.merchant));
                  return (
                    <li key={g.key} className="py-4">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {g.merchant}
                        {g.rate !== null && (
                          <Badge
                            variant={g.rate >= 0.5 ? "success" : weak ? "secondary" : "outline"}
                          >
                            {rateLabel(g.rate)}
                          </Badge>
                        )}
                        {missing && (
                          <Badge
                            variant="secondary"
                            title="You have no saved offer for this merchant"
                          >
                            Not in your offers
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {g.details || "Added to card. Deal text wasn't saved."}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {g.maxCents !== null && `Up to ${formatCents(g.maxCents)} · `}
                        {g.expiresOn
                          ? `Expires ${formatDate(g.expiresOn, today)}`
                          : "No expiry saved"}
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
                          return (
                            <span
                              key={o.id}
                              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                            >
                              <CardIcon
                                templateKey={card?.templateKey}
                                issuer={card?.issuer}
                                className="h-3 w-[19px]"
                              />
                              {card?.name ?? "Any card"}
                              {o.status === "added" && <span>· added</span>}
                            </span>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

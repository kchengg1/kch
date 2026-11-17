import type { Metadata } from "next";
import { Badge, Card, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { dueLabel } from "@/components/credit-row";
import { Meter } from "@/components/meter";
import {
  creditBreakdown,
  groupStandings,
  ordinal,
  type CardStatus,
  type CreditLine,
} from "@/lib/group-standings";
import { formatLastActive } from "@/lib/last-active";
import { formatCents } from "@/lib/money";
import { merchantKey } from "@/lib/offer-groups";
import { rateLabel, WEAK_RATE } from "@/lib/offer-value";
import { dateOf, listEveryonesOffers, loadGroupCards, today as getToday } from "@/lib/perks";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { firstName, onCardMerchantKeys, offersByPerson } from "@/lib/shared-offers";
import { summarizeCards } from "@/lib/summary";

export const metadata: Metadata = { title: "People" };

const placeVariant = (rank: number) => (rank === 1 ? "success" : "outline");

/**
 * The group at a glance: a leaderboard of credits used this year, then each
 * person's cards (how much of each card's credits they have used and where
 * they place among others holding it) and the offers on their cards.
 * Read-only. Card totals honour the "Group rankings" switch in Settings.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { user } = await requireSession();
  const today = getToday();
  const year = today.slice(0, 4);
  const { p } = await searchParams;
  const [{ people, offers, cards }, group] = await Promise.all([
    listEveryonesOffers(),
    loadGroupCards(),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const offersOf = new Map(
    offersByPerson(people, offers, user.id, today, cards).map((x) => [x.id, x]),
  );
  const { leaderboard, cardsByPerson } = groupStandings(
    summarizeCards(group.cards, group.benefits, group.usage, today),
    people,
    group.hidden,
    user.id,
  );
  const mine = onCardMerchantKeys(
    offers.filter((o) => o.userId === user.id),
    today,
  );

  // Everyone else with something to show: offers, or card totals they share.
  const others = people
    .filter((x) => x.id !== user.id && (offersOf.has(x.id) || cardsByPerson.has(x.id)))
    .map((x) => ({
      id: x.id,
      firstName: firstName(x.name),
      lastActiveAt: x.lastActiveAt,
      offers: offersOf.get(x.id),
      cards: cardsByPerson.get(x.id),
      sharing: !group.hidden.has(x.id),
    }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
  const person = others.find((x) => x.id === p) ?? others[0];
  // Credit-by-credit detail, only for cards whose owner shares group rankings.
  const groupCardById = new Map(group.cards.map((c) => [c.id, c]));
  const credits = new Map(
    (person?.cards ?? []).flatMap((c) => {
      const card = groupCardById.get(c.cardId);
      return card ? [[c.cardId, creditBreakdown(card, group.benefits, group.usage, today)]] : [];
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-muted-foreground">
          How everyone in the group is doing with their cards this year, and every Amex Offer and
          Chase Offer on their cards.
        </p>
      </div>

      {leaderboard.length >= 2 && (
        <Card className="max-w-xl">
          <p className="text-sm text-muted-foreground">Credits used in {year}</p>
          <ol className="mt-3 space-y-3">
            {leaderboard.map((s, i) => {
              const me = s.userId === user.id;
              const label = (
                <span className={me ? "font-semibold" : undefined}>
                  <span className="mr-2 inline-block w-8 text-muted-foreground">
                    {ordinal(i + 1)}
                  </span>
                  {me ? "You" : s.firstName}
                </span>
              );
              return (
                <li key={s.userId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    {me ? (
                      label
                    ) : (
                      <a
                        href={`/dashboard/people?p=${encodeURIComponent(s.userId)}`}
                        className="hover:underline"
                      >
                        {label}
                      </a>
                    )}
                    <span className="tabular-nums">
                      {formatCents(s.capturedCents)}
                      <span className="text-muted-foreground">
                        {s.availableCents
                          ? ` of ${formatCents(s.availableCents)} · ${Math.round(s.share * 100)}%`
                          : ""}
                      </span>
                    </span>
                  </div>
                  <Meter
                    value={s.capturedCents}
                    max={leaderboard[0]!.capturedCents || 1}
                    className="mt-1.5"
                  />
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Only people sharing group rankings in Settings are listed.
          </p>
        </Card>
      )}

      {!person ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Nobody else has added cards or pasted an offers page yet. Once they do, they show up
            here.
          </p>
        </Card>
      ) : (
        <>
          <nav
            aria-label="Choose a person"
            className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 text-sm whitespace-nowrap sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {others.map((x) => (
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
                {x.firstName}
              </a>
            ))}
          </nav>

          <p className="text-sm text-muted-foreground">
            Last active: {formatLastActive(person.lastActiveAt)}
          </p>

          <section className="space-y-3">
            <h2 className="font-semibold">{person.firstName}&rsquo;s cards</h2>
            {person.cards ? (
              <>
                <p className="text-sm text-muted-foreground sm:hidden">
                  Tap a card to see its credits.
                </p>
                <CardList cards={person.cards} credits={credits} year={year} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {person.sharing
                  ? "No open cards yet."
                  : `${person.firstName} keeps card totals private (Group rankings is off in their Settings).`}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">
              {person.firstName}&rsquo;s offers{" "}
              <span className="font-normal text-muted-foreground">
                · {person.offers?.groups.length ?? 0} available
              </span>
            </h2>
            {!person.offers ? (
              <p className="text-sm text-muted-foreground">No offers pasted yet.</p>
            ) : (
              <>
                {(() => {
                  const at = person.offers.lastPastedAt;
                  const ago = at ? daysBetween(dateOf(at), today) : null;
                  return (
                    <p
                      className={cn(
                        "text-sm",
                        ago === null || ago > 14 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {at
                        ? `Last pasted ${formatDate(dateOf(at), today)}${ago! > 14 ? ", so this may be out of date" : ""}. Offers are targeted, so these may not be on your cards.`
                        : "Pasted without picking a card, so freshness is unknown."}
                    </p>
                  );
                })()}
                <Card className="py-2">
                  <ul className="divide-y">
                    {person.offers.groups.map((g) => {
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
                              <span
                                className={days <= 7 ? "font-medium text-destructive" : undefined}
                              >
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
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Credits shown per list before "Show all". */
const TOP = 3;

/**
 * One row per open card: credits used this year and place among others holding
 * it. Tapping a card opens its top credits used and still to use.
 */
function CardList({
  cards,
  credits,
  year,
}: {
  cards: CardStatus[];
  credits: Map<string, { used: CreditLine[]; unused: CreditLine[] }>;
  year: string;
}) {
  return (
    <Card className="py-2">
      <ul className="divide-y">
        {cards.map((c) => {
          const detail = credits.get(c.cardId);
          const hasDetail = detail && (detail.used.length > 0 || detail.unused.length > 0);
          const row = (
            <>
              {/* Phones: name and place on one line, amounts below. Wider screens: one row. */}
              <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <CardIcon templateKey={c.templateKey} issuer={c.issuer} />
                  <span className="min-w-0 truncate font-medium">{c.name}</span>
                  {c.place && (
                    <Badge
                      className="shrink-0 whitespace-nowrap"
                      variant={placeVariant(c.place.rank)}
                      title={`Ranked by credits used in ${year} among ${c.place.of} people with this card`}
                    >
                      {ordinal(c.place.rank)} of {c.place.of}
                    </Badge>
                  )}
                </span>
                <span className="pl-10 tabular-nums sm:shrink-0 sm:pl-0">
                  {c.availableCents > 0 ? (
                    <>
                      {formatCents(c.capturedCents)}
                      <span className="text-muted-foreground">
                        {` of ${formatCents(c.availableCents)} · ${Math.round(c.share * 100)}%`}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No tracked credits</span>
                  )}
                </span>
              </div>
              {c.availableCents > 0 && (
                <Meter value={c.capturedCents} max={c.availableCents} className="mt-2" />
              )}
            </>
          );
          return (
            <li key={c.cardId} className="py-3">
              {hasDetail ? (
                <details className="group">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    {row}
                    <span className="mt-1 block text-xs text-muted-foreground group-open:hidden">
                      Show credits ▾
                    </span>
                  </summary>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <CreditColumn
                      title={`Used most in ${year}`}
                      empty="Nothing logged yet this year."
                      lines={detail.used}
                      amount={(l) => formatCents(l.usedCents)}
                      sub={(l) => (l.availableCents ? `of ${formatCents(l.availableCents)}` : "")}
                    />
                    <CreditColumn
                      title={`Still to use in ${year}`}
                      empty="Every credit used."
                      lines={detail.unused}
                      amount={(l) => formatCents(l.leftCents)}
                      sub={(l) =>
                        l.usedCents ? `${formatCents(l.usedCents)} used` : "none used yet"
                      }
                    />
                  </div>
                </details>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Top credits in one list, the rest behind "Show all". */
function CreditColumn({
  title,
  empty,
  lines,
  amount,
  sub,
}: {
  title: string;
  empty: string;
  lines: CreditLine[];
  amount: (l: CreditLine) => string;
  sub: (l: CreditLine) => string;
}) {
  const item = (l: CreditLine) => (
    <li key={l.benefitId} className="flex items-baseline justify-between gap-3 py-1">
      <span className="min-w-0 truncate">{l.name}</span>
      <span className="shrink-0 tabular-nums">
        {amount(l)} <span className="text-xs text-muted-foreground">{sub(l)}</span>
      </span>
    </li>
  );
  const rest = lines.slice(TOP);
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <>
          <ul>{lines.slice(0, TOP).map(item)}</ul>
          {rest.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show all {lines.length}
              </summary>
              <ul>{rest.map(item)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

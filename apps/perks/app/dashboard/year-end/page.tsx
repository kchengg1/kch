import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { CreditRow } from "@/components/credit-row";
import { applyCatalogUpdatesAction } from "@/app/dashboard/actions";
import { catalogUpdates, updateCount } from "@/lib/catalog-sync";
import { formatCents } from "@/lib/money";
import {
  ensureSpendTargets,
  listReferrals,
  listSpendTargets,
  loadPortfolio,
  today as getToday,
} from "@/lib/perks";
import { CADENCE_LABEL, daysBetween, formatDate, isCadence } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { spentThisYear } from "@/lib/spend-targets";
import { buildStatuses } from "@/lib/summary";
import {
  anniversaryUnused,
  APPLY_LATER,
  APPLY_NOW,
  applyTips,
  endsForGood,
  expiringAtYearEnd,
  notesFor,
  YEAR_END_SOURCE,
  yearEndOf,
  type YearEndNote,
} from "@/lib/year-end";

export const metadata: Metadata = { title: "Year-end checklist" };

const NOTE_LABEL: Record<YearEndNote["kind"], string> = {
  cap: "Cap resets",
  goal: "Spend goal",
  change: "Changing",
  info: "Note",
};

const money = (cents: number, cadence: string) =>
  cadence === "perk"
    ? "ongoing perk"
    : `${formatCents(cents)} ${isCadence(cadence) ? CADENCE_LABEL[cadence].toLowerCase() : cadence}`;

export default async function YearEndPage() {
  const { user } = await requireSession();
  const today = getToday();
  const year = today.slice(0, 4);
  const end = yearEndOf(today);
  const daysLeft = daysBetween(today, end);
  const { cards, benefits, usage } = await loadPortfolio(user.id);
  const open = cards.filter((c) => !c.closed);

  const statuses = buildStatuses(cards, benefits, usage, today);
  const expiring = expiringAtYearEnd(statuses, today);
  const expiringCents = expiring.reduce((n, s) => n + s.remainingCents, 0);
  const goneForGood = expiring.filter(endsForGood);
  const renewing = anniversaryUnused(statuses);

  await ensureSpendTargets(user.id, cards);
  const goals = (await listSpendTargets(user.id))
    .filter((g) => g.tracked && open.some((c) => c.id === g.cardId))
    .map((g) => ({
      ...g,
      spent: spentThisYear(g, today),
      card: open.find((c) => c.id === g.cardId)!,
    }));

  const cardNotes = open
    .map((card) => ({ card, notes: notesFor(card.templateKey, today) }))
    .filter((x) => x.notes.length > 0);

  const updates = open
    .map((card) => ({
      card,
      ...catalogUpdates(
        card.templateKey,
        benefits.filter((b) => b.cardId === card.id),
      ),
    }))
    .filter((u) => updateCount(u) > 0);

  const hasAmex = open.some((c) => /american express/i.test(c.issuer));
  const hasChase = open.some((c) => /chase/i.test(c.issuer));
  const myReferrals = (await listReferrals()).filter((r) => r.userId === user.id);

  const held = cards
    .filter((c) => !c.closed)
    .map((c) => ({ name: c.name, templateKey: c.templateKey }));
  const applyNow = applyTips(APPLY_NOW, held, today);
  const applyLater = applyTips(APPLY_LATER, held, today);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:underline">
            Overview
          </Link>{" "}
          /
        </p>
        <h1 className="text-2xl font-bold">Year-end checklist</h1>
        <p className="text-muted-foreground">
          {daysLeft < 0
            ? "Calendar-year credits have reset."
            : `${daysLeft === 0 ? "Today is" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} until`} December 31. ${
                expiring.length
                  ? `${formatCents(expiringCents)} in credits resets or expires by then.`
                  : "Every calendar-year credit you track is used."
              }`}
        </p>
      </div>

      {updates.length > 0 && (
        <Card className="max-w-3xl border-primary/40">
          <CardTitle>Credits changed for {year}</CardTitle>
          <CardDescription className="mt-1">
            The card catalog was updated after these cards were added. Review the changes, then
            apply them so the checklist below is complete.
          </CardDescription>
          <ul className="mt-4 divide-y">
            {updates.map(({ card, added, changed, removed }) => (
              <li key={card.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="inline-flex items-center gap-2 font-medium">
                    <CardIcon templateKey={card.templateKey} issuer={card.issuer} />
                    {card.name}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {added.map((t) => (
                      <li key={`a-${t.name}`}>
                        New: {t.name}
                        {t.cadence !== "perk" &&
                          `, ${money(Math.round((t.amount ?? 0) * 100), t.cadence)}`}
                      </li>
                    ))}
                    {changed.map(({ benefit, template }) => (
                      <li key={`c-${benefit.id}`}>
                        Changed: {benefit.name}, {money(benefit.amountCents, benefit.cadence)} →{" "}
                        {money(Math.round((template.amount ?? 0) * 100), template.cadence)}
                        {template.endsOn && `, ends ${formatDate(template.endsOn, today)}`}
                      </li>
                    ))}
                    {removed.map((b) => (
                      <li key={`r-${b.id}`}>Removed: {b.name}, no longer offered</li>
                    ))}
                  </ul>
                </div>
                <form action={applyCatalogUpdatesAction.bind(null, card.id)} className="shrink-0">
                  <Button type="submit" size="sm">
                    Apply {updateCount({ added, changed, removed })} update
                    {updateCount({ added, changed, removed }) === 1 ? "" : "s"}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <h2 className="text-lg font-semibold">Use before December 31</h2>
        <p className="text-sm text-muted-foreground">
          Calendar-year, half-year, Q4 and December credits. Charges have to post, not just be made,
          by December 31, so leave a few days.
        </p>
        <Card className="mt-3 py-2">
          {expiring.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nothing left to use this year.</p>
          ) : (
            <ul className="divide-y">
              {expiring.map((s) => (
                <CreditRow key={s.benefit.id} status={s} today={today} />
              ))}
            </ul>
          )}
        </Card>
        {goneForGood.length > 0 && (
          <p className="mt-2 text-sm font-medium text-destructive">
            {goneForGood.map((s) => s.benefit.name).join(", ")}{" "}
            {goneForGood.length === 1 ? "doesn't" : "don't"} come back after this.
          </p>
        )}
      </section>

      {renewing.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            No rush: {renewing.length} cardmember-year credit{renewing.length === 1 ? "" : "s"},
            worth {formatCents(renewing.reduce((n, s) => n + s.remainingCents, 0))}, renew on the
            card anniversary instead of January 1
          </summary>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {renewing.map((s) => (
                <CreditRow key={s.benefit.id} status={s} today={today} />
              ))}
            </ul>
          </Card>
        </details>
      )}

      {goals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Spend goals reset January 1</h2>
          <p className="text-sm text-muted-foreground">
            Finish these by December 31 or start fresh in January.
          </p>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="font-medium">{g.name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {g.card.name} · {g.reward}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {g.spent >= g.targetCents ? (
                      <Badge variant="success">Met</Badge>
                    ) : (
                      `${formatCents(g.targetCents - g.spent)} to go`
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 text-sm text-muted-foreground">
            Update what you&rsquo;ve spent from the{" "}
            <Link href="/dashboard" className="underline">
              Overview
            </Link>
            .
          </p>
        </section>
      )}

      {cardNotes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Your cards at year end</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {cardNotes.map(({ card, notes }) => (
                <li key={card.id} className="py-3 text-sm">
                  <p className="inline-flex items-center gap-2 font-medium">
                    <CardIcon templateKey={card.templateKey} issuer={card.issuer} />
                    {card.name}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {notes.map((n) => (
                      <li key={n.text} className="flex gap-2">
                        <Badge
                          variant={n.kind === "change" ? "outline" : "secondary"}
                          className="shrink-0"
                        >
                          {NOTE_LABEL[n.kind]}
                        </Badge>
                        <span className="text-muted-foreground">{n.text}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {(hasAmex || hasChase) && (
        <section>
          <h2 className="text-lg font-semibold">Referral limits reset January 1</h2>
          <Card className="mt-3 space-y-2 text-sm">
            {hasAmex && (
              <p>
                <span className="font-medium">Amex:</span>{" "}
                <span className="text-muted-foreground">
                  points from up to 5 referrals a calendar year.
                </span>
              </p>
            )}
            {hasChase && (
              <p>
                <span className="font-medium">Chase:</span>{" "}
                <span className="text-muted-foreground">
                  50,000 to 200,000 referral points a year, depending on the card.
                </span>
              </p>
            )}
            <p className="text-muted-foreground">
              If you&rsquo;ve hit this year&rsquo;s cap, wait until January to send links. If not,
              referrals that post by December 31 count toward {year}.{" "}
              <Link href="/dashboard/bonuses" className="underline">
                {myReferrals.length
                  ? `Your ${myReferrals.length} referral link${myReferrals.length === 1 ? "" : "s"}`
                  : "Add your referral links"}
              </Link>
            </p>
          </Card>
        </section>
      )}

      {(applyNow.length > 0 || applyLater.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold">Applying before year end</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {applyNow.map((t) => (
                <li key={t.name} className="py-3">
                  <p className="flex items-center gap-2 font-medium">
                    {t.name} <Badge variant="success">Good in December</Badge>
                  </p>
                  <p className="text-muted-foreground">{t.text}</p>
                </li>
              ))}
              {applyLater.map((t) => (
                <li key={t.name} className="py-3">
                  <p className="flex items-center gap-2 font-medium">
                    {t.name} <Badge variant="secondary">Wait until January</Badge>
                  </p>
                  <p className="text-muted-foreground">{t.text}</p>
                </li>
              ))}
            </ul>
          </Card>
          <p className="mt-2 text-sm text-muted-foreground">
            Check{" "}
            <Link href="/dashboard/bonuses" className="underline">
              Bonuses
            </Link>{" "}
            for application rules like Chase 5/24 before applying.
          </p>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Based on{" "}
        <a href={YEAR_END_SOURCE.url} className="underline" target="_blank" rel="noreferrer">
          {YEAR_END_SOURCE.title}
        </a>
        . Confirm terms with the issuer before a big purchase.
      </p>
    </div>
  );
}

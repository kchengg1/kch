import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle, Input } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { CreditRow, dueLabel } from "@/components/credit-row";
import { Meter } from "@/components/meter";
import { QuickCardPicker } from "@/components/quick-card-picker";
import { formatCents } from "@/lib/money";
import { msrStatus } from "@/lib/msr";
import { cardWorth } from "@/lib/worth";
import { groupOffers, merchantKey } from "@/lib/offer-groups";
import { isWeakOffer } from "@/lib/offer-value";
import {
  ensureSpendTargets,
  listHiddenMerchants,
  listOffers,
  listPoints,
  listReferrals,
  listSpendTargets,
  loadPortfolio,
  today as getToday,
} from "@/lib/perks";
import { balanceValueCents } from "@/lib/points";
import { spentThisYear } from "@/lib/spend-targets";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import {
  markBonusReceivedAction,
  setMsrSpentAction,
  setSpendTargetAction,
  setSpendTargetTrackedAction,
} from "./actions";
import { actionable, buildStatuses, summarizeCards } from "@/lib/summary";
import { expiringAtYearEnd, inYearEndWindow } from "@/lib/year-end";
import { shareableCards } from "@/lib/referrals";

/** Credits ending within this window sit in the main list; the rest are tucked below. */
const SOON_DAYS = 45;
const OFFER_DAYS = 14;
const FEE_DAYS = 60;

export default async function DashboardPage() {
  const { user } = await requireSession();
  const today = getToday();
  const [{ cards, benefits, usage }, offers, hidden, referrals, points] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
    listHiddenMerchants(user.id),
    listReferrals(),
    listPoints(user.id),
  ]);
  const shareable = shareableCards(cards, referrals, user.id);
  const sharedAny = referrals.some((r) => r.userId === user.id);
  const friendLinks = referrals.filter((r) => r.userId !== user.id).length;
  const hiddenKeys = new Set(hidden.map((h) => h.merchantKey));
  const open = cards.filter((c) => !c.closed);

  if (open.length === 0) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardTitle>Add your cards to get started</CardTitle>
        <CardDescription className="mt-2">
          Paste a list of your cards, one per line, to bring everything in at once. Cards the
          tracker recognises come with their credits already filled in.
        </CardDescription>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard/cards/import">
            <Button>Import cards</Button>
          </Link>
          <Link href="/dashboard/cards">
            <Button variant="outline">Add a card</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const statuses = buildStatuses(cards, benefits, usage, today);
  const todo = actionable(statuses);
  const yearEnd = inYearEndWindow(today) ? expiringAtYearEnd(statuses, today) : null;
  const soon = todo.filter((s) => (s.daysLeft ?? 0) <= SOON_DAYS);
  const later = todo.filter((s) => (s.daysLeft ?? 0) > SOON_DAYS);
  const thisMonth = todo.filter((s) => s.deadline && s.deadline.slice(0, 7) === today.slice(0, 7));
  const urgentCount = soon.filter((s) => (s.daysLeft ?? 99) <= 7).length;
  const sum = (list: typeof todo) => list.reduce((n, s) => n + s.remainingCents, 0);

  const summaries = summarizeCards(cards, benefits, usage, today);
  const captured = summaries.reduce((n, s) => n + s.capturedCents, 0);
  const available = summaries.reduce((n, s) => n + s.availableCents, 0);
  const fees = open.reduce((n, c) => n + c.annualFeeCents, 0);
  const capturePct = available > 0 ? Math.min(100, Math.round((captured / available) * 100)) : 0;

  const pointsValueCents = points.reduce(
    (n, p) => n + Math.round(balanceValueCents(p.balance, p.centsPerPointX100) / 100) * 100,
    0,
  );
  const pointValues = Object.fromEntries(points.map((p) => [p.program, p.centsPerPointX100 / 100]));

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const expiringOffers = offers.filter(
    (o) =>
      (o.status === "available" || o.status === "added") &&
      o.expiresOn !== null &&
      o.expiresOn >= today &&
      daysBetween(today, o.expiresOn) <= OFFER_DAYS &&
      !hiddenKeys.has(merchantKey(o.merchant)) &&
      !isWeakOffer(o.details),
  );
  await ensureSpendTargets(user.id, cards);
  const goals = (await listSpendTargets(user.id))
    .filter((g) => g.tracked && open.some((c) => c.id === g.cardId))
    .map((g) => ({
      ...g,
      spent: spentThisYear(g, today),
      card: open.find((c) => c.id === g.cardId)!,
    }))
    .sort((a, b) => b.spent / b.targetCents - a.spent / a.targetCents);
  const bonuses = open
    .map((card) => ({ card, msr: msrStatus(card, today) }))
    .filter(
      (b): b is { card: (typeof open)[number]; msr: NonNullable<ReturnType<typeof msrStatus>> } =>
        b.msr !== null && (b.msr.state === "active" || b.msr.state === "met"),
    )
    .sort((a, b) => (a.msr.daysLeft ?? 9999) - (b.msr.daysLeft ?? 9999));
  const worthOf = (cardId: string, fee: number) =>
    cardWorth(
      benefits.filter((b) => b.cardId === cardId),
      fee,
      today,
    );
  const feesDue = summaries
    .filter((s) => s.nextFeeOn && daysBetween(today, s.nextFeeOn) <= FEE_DAYS)
    .sort((a, b) => a.nextFeeOn!.localeCompare(b.nextFeeOn!));

  const cardHealth = summaries
    .filter((s) => s.availableCents > 0 || s.card.annualFeeCents > 0)
    .sort((a, b) => b.availableCents - a.availableCents);

  const year = today.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hi {user.name.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {todo.length === 0
              ? "Every tracked credit is used for its current period."
              : `${formatCents(sum(thisMonth))} in credits expires this month.`}
          </p>
        </div>
        <Link href="/dashboard/catch-up">
          <Button variant="outline" size="sm">
            {captured === 0 ? `Catch up on ${year}` : "Import or catch up"}
          </Button>
        </Link>
      </div>

      {/* Sapphire Concierge Portfolio Value Hero */}
      <section
        aria-label="Portfolio summary"
        className="sapphire-hero relative overflow-hidden rounded-[calc(var(--radius)+6px)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {year} Portfolio Value
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
              <span className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                {formatCents(captured)}
              </span>
              {available > 0 && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-300">
                  {capturePct}% captured
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-white/75">
              {available > 0 ? `of ${formatCents(available)} in tracked credits · ` : ""}
              {fees > 0
                ? captured >= fees
                  ? `${formatCents(captured - fees)} ahead of ${formatCents(fees)} annual fees`
                  : `${formatCents(fees - captured)} away from covering ${formatCents(fees)} annual fees`
                : `${open.length} open card${open.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:shrink-0">
            <div className="rounded-xl bg-white/10 px-3.5 py-2.5 backdrop-blur-xs sm:min-w-[132px] sm:text-right">
              <p className="text-[11px] font-medium text-white/70">Expiring this month</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-300">
                {formatCents(sum(thisMonth))}
              </p>
              <p className="text-[11px] text-white/65">
                {thisMonth.length === 0
                  ? "All clear"
                  : `${thisMonth.length} credit${thisMonth.length === 1 ? "" : "s"} left`}
              </p>
            </div>
            <Link
              href="/dashboard/points"
              className="rounded-xl bg-white/10 px-3.5 py-2.5 transition-colors hover:bg-white/16 backdrop-blur-xs sm:min-w-[132px] sm:text-right"
            >
              <p className="text-[11px] font-medium text-white/70">Points stash</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {formatCents(pointsValueCents)}
              </p>
              <p className="text-[11px] text-white/65">
                {points.length > 0
                  ? `${points.length} program${points.length === 1 ? "" : "s"}`
                  : "Add balances →"}
              </p>
            </Link>
          </div>
        </div>

        {available > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-amber-300 transition-all"
                style={{ width: `${capturePct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/65">
              <span>$0</span>
              {fees > 0 && <span>Annual fees: {formatCents(fees)}</span>}
              <span>Tracked: {formatCents(available)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Contextual Alerts */}
      {(yearEnd || (!sharedAny && shareable.length > 0)) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {yearEnd && (
            <Link
              href="/dashboard/year-end"
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-primary/30 bg-primary/6 px-4 py-3 transition-colors hover:bg-primary/10"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Year-end checklist</span>
                <span className="block text-xs text-muted-foreground">
                  {yearEnd.length
                    ? `${formatCents(sum(yearEnd))} in ${yearEnd.length} credit${yearEnd.length === 1 ? "" : "s"} resets by Dec 31`
                    : "Calendar-year credits are used"}
                  {" · spend caps & timing"}
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-primary" />
            </Link>
          )}

          {!sharedAny && shareable.length > 0 && (
            <Link
              href="/dashboard/bonuses#referrals"
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border bg-card px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Share your referral links</span>
                <span className="block text-xs text-muted-foreground">
                  {friendLinks > 0
                    ? `${friendLinks} link${friendLinks === 1 ? " is" : "s are"} already shared in the group.`
                    : `You have ${shareable.length} card${shareable.length === 1 ? "" : "s"} to share with friends.`}
                </span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-primary" />
            </Link>
          )}
        </div>
      )}

      {/* 2-Column Asymmetric Overview */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Primary Stream (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          <section>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Use these next</h2>
                {urgentCount > 0 && (
                  <span className="rounded-full bg-destructive/12 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-destructive">
                    {urgentCount} urgent
                  </span>
                )}
              </div>
              {soon.length > 0 && (
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCents(sum(soon))} due in {SOON_DAYS}d
                </span>
              )}
            </div>
            <Card className="mt-3 py-2">
              {soon.length === 0 ? (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  Nothing is due in the next {SOON_DAYS} days.
                </p>
              ) : (
                <ul className="divide-y">
                  {soon.map((s) => (
                    <CreditRow key={s.benefit.id} status={s} today={today} />
                  ))}
                </ul>
              )}
            </Card>
            {later.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  {later.length} more with later deadlines, worth {formatCents(sum(later))}
                </summary>
                <Card className="mt-3 py-2">
                  <ul className="divide-y">
                    {later.map((s) => (
                      <CreditRow key={s.benefit.id} status={s} today={today} />
                    ))}
                  </ul>
                </Card>
              </details>
            )}
          </section>

          {bonuses.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Sign-up bonuses in progress</h2>
              <Card className="mt-3 py-2">
                <ul className="divide-y">
                  {bonuses.map(({ card, msr }) => (
                    <li key={card.id} className="space-y-2.5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/dashboard/cards/${card.id}`}
                          className="inline-flex items-center gap-2 font-semibold hover:underline"
                        >
                          <CardIcon templateKey={card.templateKey} issuer={card.issuer} />
                          {card.name}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {card.bonusText || "Bonus"}
                          {msr.daysLeft !== null && msr.state === "active" && (
                            <span
                              className={
                                msr.daysLeft <= 14 ? "font-semibold text-destructive" : undefined
                              }
                            >
                              {" · "}
                              {dueLabel(msr.daysLeft)}
                            </span>
                          )}
                        </span>
                      </div>
                      <Meter value={msr.spentCents} max={msr.requiredCents} tone="accent" />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="tabular-nums text-muted-foreground">
                          {formatCents(msr.spentCents)} of {formatCents(msr.requiredCents)}
                          {msr.state === "active"
                            ? ` · ${formatCents(msr.leftCents)} to go${msr.perDayCents ? `, about ${formatCents(msr.perDayCents)} a day` : ""}`
                            : " · requirement met"}
                        </span>
                        {msr.state === "active" ? (
                          <form
                            action={setMsrSpentAction.bind(null, card.id)}
                            className="flex items-center gap-2"
                          >
                            <Input
                              name="spent"
                              inputMode="decimal"
                              aria-label={`Total spent so far on ${card.name}`}
                              placeholder="Total spent, $"
                              className="h-8 w-32"
                              required
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Update
                            </Button>
                          </form>
                        ) : (
                          <form action={markBonusReceivedAction.bind(null, card.id)}>
                            <Button type="submit" size="sm">
                              Bonus posted
                            </Button>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {expiringOffers.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Offers expiring soon</h2>
                <Link
                  href="/dashboard/offers"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  All offers →
                </Link>
              </div>
              <Card className="mt-3 py-2">
                <ul className="divide-y">
                  {groupOffers(expiringOffers).map((g) => (
                    <li key={g.key} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {g.merchant}
                          {g.items.every((o) => o.status === "available") && (
                            <Badge variant="outline">Not added yet</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {g.details || "Added to card"}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {g.items.map((o) => {
                            const card = o.cardId ? cardById.get(o.cardId) : undefined;
                            return card ? (
                              <span key={o.id} className="inline-flex items-center gap-1">
                                <CardIcon
                                  templateKey={card.templateKey}
                                  issuer={card.issuer}
                                  className="h-3 w-[19px]"
                                />
                                {card.name}
                                {o.status === "added" && " ✓"}
                              </span>
                            ) : null;
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {dueLabel(daysBetween(today, g.expiresOn!))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {goals.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Spending goals for {year}</h2>
              <Card className="mt-3 py-2">
                <ul className="divide-y">
                  {goals.map((g) => (
                    <li key={g.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <CardIcon templateKey={g.card.templateKey} issuer={g.card.issuer} />
                          {g.card.name}: {g.name}
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatCents(g.spent)} of {formatCents(g.targetCents)}
                        </span>
                      </div>
                      <Meter value={g.spent} max={g.targetCents} tone="primary" />
                      <p className="text-sm text-muted-foreground">
                        {g.spent >= g.targetCents
                          ? "Reached: "
                          : `${formatCents(g.targetCents - g.spent)} more for `}
                        {g.reward}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <form
                          action={setSpendTargetAction.bind(null, g.id)}
                          className="flex items-center gap-2"
                        >
                          <Input
                            name="spent"
                            inputMode="decimal"
                            aria-label={`Total spent on ${g.card.name} this year`}
                            placeholder="Spent this year, $"
                            className="h-8 w-36"
                            required
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Update
                          </Button>
                        </form>
                        <form action={setSpendTargetTrackedAction.bind(null, g.id, false)}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                          >
                            Not chasing this
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>

        {/* Sticky Utility Rail (4 cols) */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:col-span-4">
          <QuickCardPicker
            cards={open.map((c) => ({
              id: c.id,
              name: c.name,
              templateKey: c.templateKey,
              issuer: c.issuer,
              closed: c.closed,
            }))}
            pointValues={pointValues}
          />

          {feesDue.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Annual fees coming up</h2>
              <ul className="mt-3 divide-y">
                {feesDue.map((s) => {
                  const worth = worthOf(s.card.id, s.card.annualFeeCents);
                  return (
                    <li key={s.card.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/cards/${s.card.id}`}
                          className="inline-flex min-w-0 items-center gap-2 text-sm font-medium hover:underline"
                        >
                          <CardIcon
                            templateKey={s.card.templateKey}
                            issuer={s.card.issuer}
                            className="h-4 w-6"
                          />
                          <span className="truncate">{s.card.name}</span>
                        </Link>
                        <Badge variant={worth.netCents >= 0 ? "success" : "secondary"}>
                          {worth.netCents >= 0 ? "Keep" : "Review"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCents(s.card.annualFeeCents)} around{" "}
                        {formatDate(s.nextFeeOn!, today)} · worth {formatCents(worth.worthCents)}/yr
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {cardHealth.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Card health</h2>
                <Link
                  href="/dashboard/cards"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  All {open.length} →
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {cardHealth.map((s) => (
                  <li key={s.card.id}>
                    <Link
                      href={`/dashboard/cards/${s.card.id}`}
                      className="group block rounded-lg p-1 -m-1 transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                          <CardIcon
                            templateKey={s.card.templateKey}
                            issuer={s.card.issuer}
                            className="h-3.5 w-[22px]"
                          />
                          <span className="truncate group-hover:text-primary">{s.card.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {s.availableCents > 0 ? (
                            <>
                              {formatCents(s.capturedCents)}
                              <span className="font-normal text-muted-foreground">
                                /{formatCents(s.availableCents)}
                              </span>
                            </>
                          ) : (
                            <span className="font-normal text-muted-foreground">
                              {formatCents(s.card.annualFeeCents)} fee
                            </span>
                          )}
                        </span>
                      </div>
                      {s.availableCents > 0 && (
                        <Meter
                          value={s.capturedCents}
                          max={s.availableCents}
                          tone={s.capturedCents >= s.availableCents ? "success" : "primary"}
                          className="mt-1.5 h-1.5"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

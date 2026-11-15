import Link from "next/link";
import { Badge, Button, Card, CardDescription, CardTitle, Input } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { CreditRow, dueLabel } from "@/components/credit-row";
import { Meter } from "@/components/meter";
import { formatCents } from "@/lib/money";
import { msrStatus } from "@/lib/msr";
import { cardWorth } from "@/lib/worth";
import { groupOffers, merchantKey } from "@/lib/offer-groups";
import { isWeakOffer } from "@/lib/offer-value";
import {
  ensureSpendTargets,
  listHiddenMerchants,
  listOffers,
  listSpendTargets,
  loadPortfolio,
  today as getToday,
} from "@/lib/perks";
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

/** Credits ending within this window sit in the main list; the rest are tucked below. */
const SOON_DAYS = 45;
const OFFER_DAYS = 14;
const FEE_DAYS = 60;

export default async function DashboardPage() {
  const { user } = await requireSession();
  const today = getToday();
  const [{ cards, benefits, usage }, offers, hidden] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
    listHiddenMerchants(user.id),
  ]);
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

  const todo = actionable(buildStatuses(cards, benefits, usage, today));
  const soon = todo.filter((s) => (s.daysLeft ?? 0) <= SOON_DAYS);
  const later = todo.filter((s) => (s.daysLeft ?? 0) > SOON_DAYS);
  const thisMonth = todo.filter((s) => s.deadline && s.deadline.slice(0, 7) === today.slice(0, 7));
  const sum = (list: typeof todo) => list.reduce((n, s) => n + s.remainingCents, 0);

  const summaries = summarizeCards(cards, benefits, usage, today);
  const captured = summaries.reduce((n, s) => n + s.capturedCents, 0);
  const available = summaries.reduce((n, s) => n + s.availableCents, 0);
  const fees = open.reduce((n, c) => n + c.annualFeeCents, 0);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0] || "there"}</h1>
          <p className="text-muted-foreground">
            {todo.length === 0
              ? "Every tracked credit is used for its current period."
              : `${formatCents(sum(thisMonth))} in credits expires this month.`}
          </p>
        </div>
        <Link href="/dashboard/catch-up">
          <Button variant="outline">
            {captured === 0 ? `Catch up on ${today.slice(0, 4)}` : "Import or catch up"}
          </Button>
        </Link>
      </div>

      <form action="/dashboard/pick" className="flex gap-2">
        <Input
          name="q"
          placeholder="Which card? Type a store, like Whole Foods"
          aria-label="Which card should I use? Type a store or category"
          className="h-11"
        />
        <Button type="submit" className="h-11">
          Check
        </Button>
      </form>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat
          label="Expiring this month"
          value={formatCents(sum(thisMonth))}
          detail={`${thisMonth.length} credit${thisMonth.length === 1 ? "" : "s"} still unused`}
        />
        <Stat
          label={`Used in ${today.slice(0, 4)}`}
          value={formatCents(captured)}
          detail={`of ${formatCents(available)} in yearly credits you track`}
          meter={{ value: captured, max: available }}
        />
        <Stat
          label="Annual fees"
          value={formatCents(fees)}
          detail={
            captured >= fees
              ? `Credits used cover them by ${formatCents(captured - fees)}`
              : `${formatCents(fees - captured)} more in credits to break even`
          }
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Use these next</h2>
        <Card className="mt-3 py-2">
          {soon.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
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
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
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
                <li key={card.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/dashboard/cards/${card.id}`}
                      className="inline-flex items-center gap-2 font-medium hover:underline"
                    >
                      <CardIcon templateKey={card.templateKey} issuer={card.issuer} />
                      {card.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {card.bonusText || "Bonus"}
                      {msr.daysLeft !== null && msr.state === "active" && (
                        <span
                          className={
                            msr.daysLeft <= 14 ? "font-medium text-destructive" : undefined
                          }
                        >
                          {" · "}
                          {dueLabel(msr.daysLeft)}
                        </span>
                      )}
                    </span>
                  </div>
                  <Meter value={msr.spentCents} max={msr.requiredCents} />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
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
            <Link href="/dashboard/offers" className="text-sm text-primary hover:underline">
              All offers
            </Link>
          </div>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {groupOffers(expiringOffers).map((g) => (
                <li key={g.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {g.merchant}{" "}
                      {g.items.every((o) => o.status === "available") && (
                        <Badge variant="outline">Not added yet</Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{g.details || "Added to card"}</p>
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
                  <span className="shrink-0 text-sm text-muted-foreground">
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
          <h2 className="text-lg font-semibold">Spending goals for {today.slice(0, 4)}</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {goals.map((g) => (
                <li key={g.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CardIcon templateKey={g.card.templateKey} issuer={g.card.issuer} />
                      {g.card.name}: {g.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatCents(g.spent)} of {formatCents(g.targetCents)}
                    </span>
                  </div>
                  <Meter value={g.spent} max={g.targetCents} />
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

      {feesDue.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Annual fees coming up</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {feesDue.map((s) => (
                <li key={s.card.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/dashboard/cards/${s.card.id}`}
                      className="inline-flex items-center gap-2 font-medium hover:underline"
                    >
                      <CardIcon templateKey={s.card.templateKey} issuer={s.card.issuer} />
                      {s.card.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatCents(s.card.annualFeeCents)} fee around{" "}
                      {formatDate(s.nextFeeOn!, today)} · {formatCents(s.capturedCents)} in credits
                      used this year · worth{" "}
                      {formatCents(worthOf(s.card.id, s.card.annualFeeCents).worthCents)} a year to
                      you
                    </p>
                  </div>
                  <Badge
                    variant={
                      worthOf(s.card.id, s.card.annualFeeCents).netCents >= 0
                        ? "success"
                        : "secondary"
                    }
                  >
                    {worthOf(s.card.id, s.card.annualFeeCents).netCents >= 0
                      ? "Worth keeping"
                      : "Review before renewal"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">By card</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {summaries
            .filter((s) => s.availableCents > 0 || s.card.annualFeeCents > 0)
            .sort((a, b) => b.availableCents - a.availableCents)
            .map((s) => (
              <Link key={s.card.id} href={`/dashboard/cards/${s.card.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CardIcon templateKey={s.card.templateKey} issuer={s.card.issuer} />
                      {s.card.name}
                    </CardTitle>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatCents(s.card.annualFeeCents)} fee
                    </span>
                  </div>
                  {s.availableCents > 0 ? (
                    <>
                      <p className="mt-3 text-sm">
                        <span className="font-semibold tabular-nums">
                          {formatCents(s.capturedCents)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          of {formatCents(s.availableCents)} used
                        </span>
                      </p>
                      <Meter value={s.capturedCents} max={s.availableCents} className="mt-2" />
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No credits to track</p>
                  )}
                </Card>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  meter,
}: {
  label: string;
  value: string;
  detail: string;
  meter?: { value: number; max: number };
}) {
  return (
    // Three across even on a phone: compact padding and type, details from tablet width up.
    <Card className="p-3 sm:p-6">
      <p className="text-xs leading-tight text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p>
      {meter && <Meter {...meter} className="mt-2 sm:mt-3" />}
      <p className="mt-2 hidden text-sm text-muted-foreground sm:block">{detail}</p>
    </Card>
  );
}

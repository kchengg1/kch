import {
  currentPeriod,
  daysBetween,
  isCadence,
  nextAnniversary,
  periodsPerYear,
  periodsThisYear,
  type Cadence,
  type Period,
} from "./periods";

/** Minimal row shapes, so this module stays free of database imports. */
export type CardRow = {
  id: string;
  name: string;
  annualFeeCents: number;
  openedOn: string | null;
  closed: boolean;
};
export type BenefitRow = {
  id: string;
  cardId: string;
  name: string;
  cadence: string;
  amountCents: number;
  notes: string;
  enrollRequired: boolean;
  enrolled: boolean;
  tracked: boolean;
  endsOn: string | null;
  sortOrder: number;
};
export type UsageRow = { benefitId: string; periodKey: string; usedCents: number };

export type BenefitStatus = {
  benefit: BenefitRow;
  card: CardRow;
  cadence: Cadence;
  /** Null for ongoing perks, which have nothing to use up. */
  period: Period | null;
  usedCents: number;
  remainingCents: number;
  /** Fully used, or ticked off for reminders that carry no dollar amount. */
  done: boolean;
  /** Days until the period (or the benefit itself) ends, counting today as 0. */
  daysLeft: number | null;
  deadline: string | null;
};

export type CardSummary = {
  card: CardRow;
  /** Value of tracked credits over a full year. */
  availableCents: number;
  /** Logged this calendar year (current card year for anniversary credits). */
  capturedCents: number;
  nextFeeOn: string | null;
};

const usageKey = (benefitId: string, periodKey: string) => `${benefitId}|${periodKey}`;

export function indexUsage(usage: UsageRow[]): Map<string, number> {
  return new Map(usage.map((u) => [usageKey(u.benefitId, u.periodKey), u.usedCents]));
}

export function usedIn(index: Map<string, number>, benefitId: string, periodKey: string) {
  return index.get(usageKey(benefitId, periodKey));
}

/** Where every benefit on an open card stands today. */
export function buildStatuses(
  cards: CardRow[],
  benefits: BenefitRow[],
  usage: UsageRow[],
  today: string,
): BenefitStatus[] {
  const cardById = new Map(cards.filter((c) => !c.closed).map((c) => [c.id, c]));
  const index = indexUsage(usage);
  const out: BenefitStatus[] = [];
  for (const benefit of benefits) {
    const card = cardById.get(benefit.cardId);
    if (!card || !isCadence(benefit.cadence)) continue;
    if (benefit.endsOn && benefit.endsOn < today) continue;
    const period = currentPeriod(benefit.cadence, today, card.openedOn);
    const logged = period ? usedIn(index, benefit.id, period.key) : undefined;
    const usedCents = Math.min(logged ?? 0, benefit.amountCents);
    const deadline =
      period && benefit.endsOn && benefit.endsOn < period.end
        ? benefit.endsOn
        : (period?.end ?? null);
    out.push({
      benefit,
      card,
      cadence: benefit.cadence,
      period,
      usedCents,
      remainingCents: benefit.amountCents - usedCents,
      done: logged !== undefined && logged >= benefit.amountCents,
      daysLeft: deadline ? daysBetween(today, deadline) : null,
      deadline,
    });
  }
  return out;
}

/** Benefits that still need action, soonest deadline first. */
export function actionable(statuses: BenefitStatus[]): BenefitStatus[] {
  return statuses
    .filter((s) => s.period && s.benefit.tracked && !s.done)
    .sort(
      (a, b) =>
        (a.daysLeft ?? 0) - (b.daysLeft ?? 0) ||
        b.remainingCents - a.remainingCents ||
        a.benefit.name.localeCompare(b.benefit.name),
    );
}

export function summarizeCards(
  cards: CardRow[],
  benefits: BenefitRow[],
  usage: UsageRow[],
  today: string,
): CardSummary[] {
  const index = indexUsage(usage);
  return cards
    .filter((c) => !c.closed)
    .map((card) => {
      let availableCents = 0;
      let capturedCents = 0;
      for (const b of benefits) {
        if (b.cardId !== card.id || !isCadence(b.cadence)) continue;
        const expired = Boolean(b.endsOn && b.endsOn < today);
        for (const p of periodsThisYear(b.cadence, today, card.openedOn)) {
          capturedCents += Math.min(usedIn(index, b.id, p.key) ?? 0, b.amountCents);
        }
        if (b.tracked && !expired) {
          // A four-year credit counts in full: it is either available now or already used.
          availableCents += Math.round(
            b.amountCents *
              Math.max(periodsPerYear(b.cadence), b.cadence === "quadrennial" ? 1 : 0),
          );
        }
      }
      return {
        card,
        availableCents,
        capturedCents,
        nextFeeOn:
          card.openedOn && card.annualFeeCents > 0 ? nextAnniversary(card.openedOn, today) : null,
      };
    });
}

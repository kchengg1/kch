/**
 * Group leaderboard and card status for the People tab: how much of their
 * cards' credits each person has used this year, overall and card by card.
 * People who switched off "Group rankings" in Settings are left out, except the
 * viewer, who always sees their own numbers. Pure, so it can be tested without
 * a database.
 */
import { firstName, type Person } from "./shared-offers";
import { isCadence, periodsPerYear, periodsThisYear } from "./periods";
import {
  indexUsage,
  usedIn,
  type BenefitRow,
  type CardRow,
  type CardSummary,
  type UsageRow,
} from "./summary";

export type GroupCard = CardRow & {
  userId: string;
  issuer: string;
  templateKey: string | null;
};

export type Standing = {
  userId: string;
  firstName: string;
  capturedCents: number;
  availableCents: number;
  /** Share of this year's credits used, 0 when the cards have none. */
  share: number;
};

export type CardStatus = {
  cardId: string;
  name: string;
  issuer: string;
  templateKey: string | null;
  annualFeeCents: number;
  capturedCents: number;
  availableCents: number;
  share: number;
  /** Place among everyone sharing who holds the same kind of card, when two or more do. */
  place: { rank: number; of: number } | null;
};

const share = (captured: number, available: number) => (available ? captured / available : 0);
const byCaptured = (
  a: { capturedCents: number; share: number },
  b: { capturedCents: number; share: number },
) => b.capturedCents - a.capturedCents || b.share - a.share;

export function groupStandings<C extends GroupCard>(
  summaries: CardSummary<C>[],
  people: Person[],
  /** Users who switched sharing off. */
  hidden: Set<string>,
  viewerId: string,
): { leaderboard: Standing[]; cardsByPerson: Map<string, CardStatus[]> } {
  const visible = summaries.filter((s) => s.card.userId === viewerId || !hidden.has(s.card.userId));

  // Place on each kind of card, among the visible holders.
  const place = new Map<string, { rank: number; of: number }>();
  const byTemplate = new Map<string, CardSummary<C>[]>();
  for (const s of visible) {
    if (!s.card.templateKey) continue;
    byTemplate.set(s.card.templateKey, [...(byTemplate.get(s.card.templateKey) ?? []), s]);
  }
  for (const group of byTemplate.values()) {
    if (group.length < 2) continue;
    const ranked = group
      .map((s) => ({
        s,
        capturedCents: s.capturedCents,
        share: share(s.capturedCents, s.availableCents),
      }))
      .sort(byCaptured);
    ranked.forEach((r, i) => place.set(r.s.card.id, { rank: i + 1, of: ranked.length }));
  }

  const cardsByPerson = new Map<string, CardStatus[]>();
  for (const s of visible) {
    const list = cardsByPerson.get(s.card.userId) ?? [];
    list.push({
      cardId: s.card.id,
      name: s.card.name,
      issuer: s.card.issuer,
      templateKey: s.card.templateKey,
      annualFeeCents: s.card.annualFeeCents,
      capturedCents: s.capturedCents,
      availableCents: s.availableCents,
      share: share(s.capturedCents, s.availableCents),
      place: place.get(s.card.id) ?? null,
    });
    cardsByPerson.set(s.card.userId, list);
  }
  for (const list of cardsByPerson.values())
    list.sort((a, b) => byCaptured(a, b) || a.name.localeCompare(b.name));

  const nameOf = new Map(people.map((p) => [p.id, firstName(p.name)]));
  const leaderboard = [...cardsByPerson.entries()]
    .map(([userId, cards]) => {
      const capturedCents = cards.reduce((n, c) => n + c.capturedCents, 0);
      const availableCents = cards.reduce((n, c) => n + c.availableCents, 0);
      return {
        userId,
        firstName: nameOf.get(userId) ?? "Someone",
        capturedCents,
        availableCents,
        share: share(capturedCents, availableCents),
      };
    })
    .filter((s) => s.availableCents > 0 || s.capturedCents > 0)
    .sort(byCaptured);

  return { leaderboard, cardsByPerson };
}

/** "1st", "2nd", "3rd", "4th", … */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export type CreditLine = {
  benefitId: string;
  name: string;
  /** Used this calendar year (current card year for anniversary credits). */
  usedCents: number;
  /** Full-year value of the credit; 0 when it isn't tracked or has ended. */
  availableCents: number;
  /** Still to use this year. */
  leftCents: number;
};

/**
 * One card's credits split into the ones used most and the ones with the most
 * left this year, for the People tab. Same sums as `summarizeCards`, per credit.
 */
export function creditBreakdown(
  card: CardRow,
  benefits: BenefitRow[],
  usage: UsageRow[],
  today: string,
): { used: CreditLine[]; unused: CreditLine[] } {
  const index = indexUsage(usage);
  const lines: CreditLine[] = [];
  for (const b of benefits) {
    if (b.cardId !== card.id || !isCadence(b.cadence) || b.amountCents <= 0) continue;
    const expired = Boolean(b.endsOn && b.endsOn < today);
    let usedCents = 0;
    for (const p of periodsThisYear(b.cadence, today, card.openedOn)) {
      usedCents += Math.min(usedIn(index, b.id, p.key) ?? 0, b.amountCents);
    }
    const availableCents =
      b.tracked && !expired
        ? Math.round(
            b.amountCents *
              Math.max(periodsPerYear(b.cadence), b.cadence === "quadrennial" ? 1 : 0),
          )
        : 0;
    if (usedCents === 0 && availableCents === 0) continue;
    lines.push({
      benefitId: b.id,
      name: b.name,
      usedCents,
      availableCents,
      leftCents: Math.max(0, availableCents - usedCents),
    });
  }
  const byName = (a: CreditLine, b: CreditLine) => a.name.localeCompare(b.name);
  return {
    used: lines
      .filter((l) => l.usedCents > 0)
      .sort((a, b) => b.usedCents - a.usedCents || byName(a, b)),
    unused: lines
      .filter((l) => l.leftCents > 0)
      .sort((a, b) => b.leftCents - a.leftCents || byName(a, b)),
  };
}

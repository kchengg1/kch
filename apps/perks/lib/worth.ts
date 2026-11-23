import type { BreakEvenStatus } from "@kch/perks-types";
import { daysBetween, isCadence, periodsPerYear } from "./periods";

/**
 * "Is this card worth its fee?" in the spirit of the owner's Platinum and
 * Sapphire Reserve math tabs: each benefit's advertised yearly value next to
 * what it is really worth to them.
 */
export type WorthBenefit = {
  cadence: string;
  amountCents: number;
  tracked: boolean;
  myValueCents: number | null;
  endsOn: string | null;
};

/** Advertised value per year. A four-year credit counts a quarter per year. */
export function faceValueCents(b: WorthBenefit): number {
  if (!isCadence(b.cadence) || b.cadence === "perk") return 0;
  return Math.round(b.amountCents * periodsPerYear(b.cadence));
}

/**
 * Worth to the owner per year: their own figure if set; otherwise face value
 * for tracked credits and nothing for credits they stopped tracking or perks.
 */
export function myValueCents(b: WorthBenefit): number {
  if (b.myValueCents !== null) return b.myValueCents;
  return b.tracked ? faceValueCents(b) : 0;
}

export function cardWorth(benefits: WorthBenefit[], annualFeeCents: number, today: string) {
  const live = benefits.filter((b) => !(b.endsOn && b.endsOn < today));
  const advertisedCents = live.reduce((n, b) => n + faceValueCents(b), 0);
  const worthCents = live.reduce((n, b) => n + myValueCents(b), 0);
  return { advertisedCents, worthCents, netCents: worthCents - annualFeeCents };
}

/** Grace buffer (in percentage points) before flagging a card as behind pace. */
const PACE_GRACE_PP = 5;

/** Percentage of the calendar year elapsed as of `today` (YYYY-MM-DD), clamped to 1–100. */
export function yearProgressPct(today: string): number {
  const year = today.slice(0, 4);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const totalDays = daysBetween(start, end) + 1;
  const elapsedDays = daysBetween(start, today) + 1;
  return Math.min(100, Math.max(1, Math.round((elapsedDays / totalDays) * 100)));
}

/**
 * How close captured credits are to breaking even on the annual fee(s).
 * Returns null for $0-fee cards/portfolios where break-even is not meaningful.
 */
export function breakEvenStatus(
  capturedCents: number,
  annualFeeCents: number,
  today: string,
): BreakEvenStatus | null {
  if (annualFeeCents <= 0) return null;
  const safeCaptured = Math.max(0, capturedCents);
  const covered = safeCaptured >= annualFeeCents;
  const rawPct = Math.round((safeCaptured / annualFeeCents) * 100);
  // Never display 100% while still short of the fee due to rounding.
  const pct = covered ? Math.max(100, rawPct) : Math.min(99, rawPct);
  const expectedPct = yearProgressPct(today);
  const state: BreakEvenStatus["state"] = covered
    ? "covered"
    : pct >= expectedPct - PACE_GRACE_PP
      ? "on-pace"
      : "behind";
  return {
    pct,
    expectedPct,
    remainingCents: Math.max(0, annualFeeCents - safeCaptured),
    netCents: safeCaptured - annualFeeCents,
    state,
  };
}

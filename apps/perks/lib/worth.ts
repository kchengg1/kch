import { isCadence, periodsPerYear } from "./periods";

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

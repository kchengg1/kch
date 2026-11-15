import { daysBetween } from "./periods";

/** Where a new card's minimum spend stands. */
export type MsrStatus = {
  requiredCents: number;
  spentCents: number;
  leftCents: number;
  /** Days until the deadline, counting today as 0. Null without a deadline. */
  daysLeft: number | null;
  /** Average spend needed per day to finish in time, in cents. */
  perDayCents: number | null;
  state: "active" | "met" | "missed" | "received";
};

export function msrStatus(
  card: {
    msrCents: number | null;
    msrDeadline: string | null;
    msrSpentCents: number;
    bonusReceivedOn: string | null;
  },
  today: string,
): MsrStatus | null {
  if (!card.msrCents || card.msrCents <= 0) return null;
  const spent = Math.max(0, card.msrSpentCents);
  const left = Math.max(0, card.msrCents - spent);
  const daysLeft = card.msrDeadline ? daysBetween(today, card.msrDeadline) : null;
  const state = card.bonusReceivedOn
    ? "received"
    : left === 0
      ? "met"
      : daysLeft !== null && daysLeft < 0
        ? "missed"
        : "active";
  return {
    requiredCents: card.msrCents,
    spentCents: spent,
    leftCents: left,
    daysLeft,
    perDayCents: state === "active" && daysLeft !== null ? Math.ceil(left / (daysLeft + 1)) : null,
    state,
  };
}

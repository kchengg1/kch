/**
 * Rewards some cards unlock at a total spend in a calendar year. Added to a
 * card automatically so progress can be tracked like a sign-up bonus.
 */
export type SpendTargetTemplate = { name: string; targetDollars: number; reward: string };

export const SPEND_TARGETS: Record<string, SpendTargetTemplate[]> = {
  "chase-sapphire-reserve": [
    {
      name: "$75,000 spend perks",
      targetDollars: 75000,
      reward:
        "Southwest status, a $500 Southwest credit, IHG Diamond, Hyatt Explorist and $250 for The Shops at Chase",
    },
  ],
  "amex-platinum": [
    {
      name: "Centurion Lounge guests",
      targetDollars: 75000,
      reward: "Two free guests per Centurion Lounge visit",
    },
  ],
  "amex-business-platinum": [
    {
      name: "Centurion Lounge guests",
      targetDollars: 75000,
      reward: "Two free guests per Centurion Lounge visit",
    },
    {
      name: "$250,000 spend credits",
      targetDollars: 250000,
      reward: "A $1,200 credit on flights booked through Amex Travel, plus the One AP credit",
    },
  ],
  "capital-one-venture-x": [
    {
      name: "Lounge guests",
      targetDollars: 75000,
      reward: "Free guests in Capital One Lounges",
    },
  ],
  "chase-hyatt": [
    {
      name: "Second free night",
      targetDollars: 15000,
      reward: "A Category 1–4 free night certificate",
    },
  ],
  "chase-hyatt-business": [
    {
      name: "10% points back",
      targetDollars: 50000,
      reward: "10% of the Hyatt points you redeem back, for the rest of the year",
    },
  ],
  "chase-marriott-boundless": [
    {
      name: "Gold Elite status",
      targetDollars: 35000,
      reward: "Marriott Gold Elite through next year",
    },
  ],
  "chase-ihg-premier": [
    {
      name: "$100 credit and 10,000 points",
      targetDollars: 20000,
      reward: "$100 statement credit and 10,000 bonus points",
    },
  ],
};

/** Spend logged for this calendar year; a total from an earlier year counts as nothing. */
export function spentThisYear(
  target: { spentCents: number; periodKey: string },
  today: string,
): number {
  return target.periodKey === today.slice(0, 4) ? target.spentCents : 0;
}

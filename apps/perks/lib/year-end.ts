import type { BenefitStatus } from "./summary";

/**
 * The year-end checklist: what resets on December 31 and what to do about it.
 * Credits come from the user's own benefits; the notes below come from Doctor
 * of Credit's annual year-end checklist and are keyed to catalog cards.
 */
export const YEAR_END_SOURCE = {
  title: "Doctor of Credit: Year-End Credit Card Checklist for 2026",
  url: "https://www.doctorofcredit.com/year-end-credit-card-checklist-for-2026-travel-credits-spend-reset-application-strategy-more/",
};

/** The overview shows the checklist from November 1. */
export function inYearEndWindow(today: string): boolean {
  return Number(today.slice(5, 7)) >= 11;
}

export const yearEndOf = (today: string) => `${today.slice(0, 4)}-12-31`;

/** Unused credits that are gone after December 31: the period ends then, or the benefit does. */
export function expiringAtYearEnd(statuses: BenefitStatus[], today: string): BenefitStatus[] {
  const end = yearEndOf(today);
  return statuses
    .filter(
      (s) =>
        s.period &&
        s.benefit.tracked &&
        !s.done &&
        s.cadence !== "anniversary" &&
        s.cadence !== "quadrennial" &&
        s.deadline !== null &&
        s.deadline <= end,
    )
    .sort(
      (a, b) =>
        (a.deadline ?? "").localeCompare(b.deadline ?? "") ||
        b.remainingCents - a.remainingCents ||
        a.card.name.localeCompare(b.card.name),
    );
}

/** Unused cardmember-year credits: no year-end rush, they renew on the card's anniversary. */
export function anniversaryUnused(statuses: BenefitStatus[]): BenefitStatus[] {
  return statuses
    .filter((s) => s.cadence === "anniversary" && s.benefit.tracked && !s.done && s.period)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
}

/** Was the credit gone for good after this deadline, rather than renewing? */
export const endsForGood = (s: BenefitStatus) =>
  s.benefit.endsOn !== null && s.benefit.endsOn === s.deadline;

export type YearEndNote = {
  /** cap: earning limit that resets; goal: spend that unlocks a reward; change: something new next year; info: anything else. */
  kind: "cap" | "goal" | "change" | "info";
  text: string;
  /** Hide the note after this date. */
  until?: string;
};

export const YEAR_END_NOTES: Record<string, YearEndNote[]> = {
  "amex-blue-business-plus": [
    {
      kind: "cap",
      text: "2x everywhere on the first $50,000 a calendar year. The cap resets January 1.",
    },
  ],
  "amex-gold": [
    {
      kind: "cap",
      text: "4x at U.S. supermarkets on up to $25,000 a calendar year. Resets January 1.",
    },
  ],
  "amex-everyday": [
    {
      kind: "cap",
      text: "2x at U.S. supermarkets on up to $6,000 a calendar year. Resets January 1.",
    },
  ],
  "amex-platinum": [
    { kind: "cap", text: "5x on flights up to $500,000 a calendar year." },
    {
      kind: "goal",
      text: "$75,000 of spend in the calendar year adds two free Centurion Lounge guests.",
    },
    {
      kind: "info",
      text: "The airline fee credit counts by calendar year, not statement. Make sure charges post by December 31.",
    },
    {
      kind: "change",
      text: "From January 1, 2027, every Fine Hotels + Resorts and Hotel Collection booking needs a 2-night minimum.",
      until: "2027-01-31",
    },
  ],
  "amex-business-platinum": [
    {
      kind: "goal",
      text: "$75,000 in a calendar year adds two free Centurion Lounge guests; $250,000 unlocks a $1,200 Amex Travel flight credit.",
    },
    {
      kind: "info",
      text: "Dell is slow to ship, and the charge has to post by December 31. Check Amex Offers for Dell first. A further $1,000 credit unlocks after $5,000 at Dell in the calendar year.",
    },
    {
      kind: "change",
      text: "From January 1, 2027, every Fine Hotels + Resorts and Hotel Collection booking needs a 2-night minimum.",
      until: "2027-01-31",
    },
  ],
  "chase-sapphire-reserve": [
    {
      kind: "goal",
      text: "$75,000 in a calendar year unlocks Southwest status, a $500 Southwest credit, IHG Diamond and $250 for The Shops.",
    },
    {
      kind: "info",
      text: "The $300 travel credit renews on your card anniversary, so there's no year-end rush for it.",
    },
    {
      kind: "change",
      text: "The 2026-only $250 hotel credit expires December 31, 2026 and isn't slated to return.",
      until: "2026-12-31",
    },
  ],
  "chase-sapphire-preferred": [
    {
      kind: "change",
      text: "The one-time Apple TV benefit has to be activated by December 31, 2026.",
      until: "2026-12-31",
    },
  ],
  "chase-freedom": [
    { kind: "cap", text: "This quarter's 5% categories end December 31. Activate Q1 in January." },
  ],
  "chase-freedom-flex": [
    { kind: "cap", text: "This quarter's 5% categories end December 31. Activate Q1 in January." },
  ],
  "discover-it": [
    { kind: "cap", text: "This quarter's 5% categories end December 31. Activate Q1 in January." },
  ],
  "chase-ink-business-preferred": [
    {
      kind: "info",
      text: "The $150,000 3x cap runs on your account year, not the calendar year.",
    },
  ],
  "chase-ink-business-cash": [
    { kind: "info", text: "The 5x and 2x caps run on your account year, not the calendar year." },
  ],
  "chase-hyatt": [
    {
      kind: "goal",
      text: "$15,000 in the calendar year earns a second free night. Finish now or start fresh January 1. Elite nights from spend (2 per $5,000) never reset.",
    },
  ],
  "chase-hyatt-business": [
    {
      kind: "goal",
      text: "5 elite nights per $10,000 resets with the calendar year. $50,000 earns 10% of redeemed points back for the rest of the year (up to 20,000).",
    },
  ],
  "chase-ihg-premier": [
    {
      kind: "info",
      text: "The free night follows your card anniversary. The $100 airline credit needs $250 of airfare in the calendar year.",
    },
  ],
  "chase-marriott-boundless": [
    {
      kind: "info",
      text: "Spend $250 directly with airlines by December 31 for this half's $50 credit. Another $50 runs January to June 2027.",
      until: "2026-12-31",
    },
  ],
  "chase-aeroplan": [
    {
      kind: "change",
      text: "Many Aeroplan card benefits change on January 1, 2027. Use this half's $50 Air Canada credit first.",
      until: "2027-01-31",
    },
  ],
  "capital-one-venture-x": [
    {
      kind: "info",
      text: "The $300 travel credit renews on your account anniversary, not January 1.",
    },
    { kind: "goal", text: "$75,000 in the calendar year adds Capital One Lounge guests." },
  ],
  "capital-one-venture-x-business": [
    {
      kind: "info",
      text: "The $300 travel credit renews on your account anniversary, not January 1.",
    },
  ],
  "citi-aadvantage-platinum-select": [
    {
      kind: "info",
      text: "The $20,000 flight-discount spend counts over your cardmember year (12 statements), not the calendar year.",
    },
    {
      kind: "change",
      text: "Many changes arrive January 24, 2027, including $100 a year in inflight credits and a $150 flight discount.",
      until: "2027-02-28",
    },
  ],
};

export function notesFor(templateKey: string | null | undefined, today: string): YearEndNote[] {
  return (templateKey ? (YEAR_END_NOTES[templateKey] ?? []) : []).filter(
    (n) => !n.until || today <= n.until,
  );
}

export type ApplyTip = {
  name: string;
  /** Matches a card the user already holds, by name or catalog key. */
  match: RegExp;
  text: string;
  until?: string;
};

/** Cards worth opening in December for a double dip on calendar-year credits. */
export const APPLY_NOW: ApplyTip[] = [
  {
    name: "Amex Platinum",
    match: /amex(?!.*(bus|biz)).*plat|^amex-platinum$/i,
    text: "Calendar-year credits (airline fee, CLEAR, hotel, Resy) can be used once this year and again from January, before the second annual fee. The fee usually posts about a month after approval.",
  },
  {
    name: "Amex Business Platinum",
    match: /amex.*(bus|biz).*plat|^amex-business-platinum$/i,
    text: "Same double dip: Dell, airline fee, CLEAR and hotel credits reset January 1.",
  },
  {
    name: "Citi Strata Elite",
    match: /strata elite/i,
    text: "The $300 hotel credit, $200 splurge credit and Admirals Club passes all reset January 1, so December approval can mean a triple dip.",
  },
  {
    name: "Bank of America Premium Rewards Elite",
    match: /premium rewards elite/i,
    text: "$300 airline incidental and $150 lifestyle credits reset with the calendar year.",
  },
  {
    name: "Southwest personal cards",
    match: /southwest/i,
    text: "Approved by December 2, 2026, the sign-up bonus still counts toward the Companion Pass. From 2027 sign-up bonuses no longer count.",
    until: "2026-12-02",
  },
];

/** Cards where a late-December application wastes credits. */
export const APPLY_LATER: ApplyTip[] = [
  {
    name: "Chase Sapphire Reserve",
    match: /sapphire reserve|^chase-sapphire-reserve$/i,
    text: "The dining and StubHub credits are split January–June and July–December. Applying at the end of December or June leaves no time to use the first half.",
  },
];

export function applyTips(
  tips: ApplyTip[],
  held: { name: string; templateKey: string | null }[],
  today: string,
): ApplyTip[] {
  return tips.filter(
    (t) =>
      (!t.until || today <= t.until) &&
      !held.some((c) => t.match.test(c.name) || (c.templateKey && t.match.test(c.templateKey))),
  );
}

/**
 * Points and miles: balances, what they are worth, and whether a redemption
 * beats paying cash. Default values come from Frequent Miler's Reasonable
 * Redemption Values (RRVs), in cents per point; balances track these live
 * estimates automatically unless overridden with a custom value.
 */
export const VALUATION_SOURCE = {
  name: "Frequent Miler",
  label: "Frequent Miler RRVs",
  url: "https://frequentmiler.com/reasonable-redemption-values-rrvs/",
  reviewed: "2026-11",
} as const;

export const DEFAULT_CENTS_PER_POINT: Record<string, number> = {
  "American Express Membership Rewards": 1.5,
  "Chase Ultimate Rewards": 1.5,
  "Capital One Venture Rewards": 1.45,
  "Citi ThankYou": 1.5,
  "Bilt Rewards": 1.55,
  "Wells Fargo Rewards": 1.4,
  Hyatt: 1.5,
  "Marriott Bonvoy": 0.73,
  "Hilton Honors": 0.35,
  "IHG One Rewards": 0.59,
  Wyndham: 0.57,
  "Choice Privileges": 0.75,
  "Alaska / Hawaiian Atmos Rewards": 1.5,
  "American AAdvantage": 1.4,
  "Delta SkyMiles": 1.1,
  "United MileagePlus": 1.3,
  "Southwest Rapid Rewards": 1.3,
  "JetBlue TrueBlue": 1.3,
  Aeroplan: 1.4,
  "British Airways Avios": 1.1,
  "Flying Blue": 1.3,
  "Avianca LifeMiles": 1.3,
  "Virgin Atlantic": 1.5,
  "ANA Mileage Club": 1.4,
  "Singapore KrisFlyer": 1.3,
  "Cathay Pacific Asia Miles": 1.1,
  "Turkish Miles&Smiles": 1.3,
  "Emirates Skywards": 1.2,
  "Etihad Guest": 1.4,
  "Qatar Privilege Club": 1.1,
  "Korean Air SKYPASS": 1.3,
  "Amtrak Guest Rewards": 2.56,
  "Discover Cashback": 1.0,
  "Cash back": 1.0,
};

/** Names people use in sheets and chats, mapped to the program names above. */
const ALIASES: [RegExp, string][] = [
  [/membership rewards|\bmr\b|\bamex\b.*points/i, "American Express Membership Rewards"],
  [/ultimate rewards|\bur\b/i, "Chase Ultimate Rewards"],
  [/capital one|venture/i, "Capital One Venture Rewards"],
  [/thank ?you/i, "Citi ThankYou"],
  [/bilt/i, "Bilt Rewards"],
  [/wells ?fargo/i, "Wells Fargo Rewards"],
  [/hyatt/i, "Hyatt"],
  [/marriott|bonvoy/i, "Marriott Bonvoy"],
  [/hilton/i, "Hilton Honors"],
  [/\bihg\b/i, "IHG One Rewards"],
  [/wyndham/i, "Wyndham"],
  [/choice/i, "Choice Privileges"],
  [/alaska|atmos|hawaiian/i, "Alaska / Hawaiian Atmos Rewards"],
  [/aadvantage|american airlines/i, "American AAdvantage"],
  [/delta|skymiles/i, "Delta SkyMiles"],
  [/united|mileageplus/i, "United MileagePlus"],
  [/southwest/i, "Southwest Rapid Rewards"],
  [/jetblue/i, "JetBlue TrueBlue"],
  [/aeroplan/i, "Aeroplan"],
  [/avios|british airways/i, "British Airways Avios"],
  [/flying blue/i, "Flying Blue"],
  [/lifemiles|avianca/i, "Avianca LifeMiles"],
  [/virgin/i, "Virgin Atlantic"],
  [/\bana\b/i, "ANA Mileage Club"],
  [/krisflyer|singapore/i, "Singapore KrisFlyer"],
  [/asia miles|cathay/i, "Cathay Pacific Asia Miles"],
  [/turkish/i, "Turkish Miles&Smiles"],
  [/emirates/i, "Emirates Skywards"],
  [/etihad/i, "Etihad Guest"],
  [/qatar/i, "Qatar Privilege Club"],
  [/korean/i, "Korean Air SKYPASS"],
  [/amtrak/i, "Amtrak Guest Rewards"],
  [/discover/i, "Discover Cashback"],
  [/cash ?back/i, "Cash back"],
];

export const PROGRAMS = Object.keys(DEFAULT_CENTS_PER_POINT);

/** The standard program name for whatever someone typed, or the trimmed text itself. */
export function normalizeProgram(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  const exact = PROGRAMS.find((p) => p.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  return ALIASES.find(([re]) => re.test(trimmed))?.[1] ?? trimmed;
}

export function defaultCentsPerPoint(program: string): number {
  return DEFAULT_CENTS_PER_POINT[normalizeProgram(program)] ?? 1;
}

export function defaultCentsPerPointX100(program: string): number {
  return Math.round(defaultCentsPerPoint(program) * 100);
}

/**
 * Active valuation for a saved balance in hundredths of a cent.
 * Auto-tracked rows (`customValue !== true`) always follow the current
 * Frequent Miler RRV so portfolio estimates stay up to date automatically.
 */
export function effectiveCentsPerPointX100(row: {
  program: string;
  centsPerPointX100: number;
  customValue?: boolean;
}): number {
  return row.customValue ? row.centsPerPointX100 : defaultCentsPerPointX100(row.program);
}

/**
 * Parse a user-supplied cents-per-point string and decide whether it is an
 * explicit custom override or matches the automatic Frequent Miler estimate.
 * Blank input resets to automatic tracking.
 */
export function resolvePointValuation(
  program: string,
  cppInput: string | undefined,
): { centsPerPointX100: number; customValue: boolean } | null {
  const autoCppX100 = defaultCentsPerPointX100(program);
  const cleaned = cppInput?.trim() ?? "";
  if (!cleaned) return { centsPerPointX100: autoCppX100, customValue: false };
  const n = Number(cleaned.replace(/[¢\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  const parsed = Math.round(n * 100);
  if (parsed === autoCppX100) return { centsPerPointX100: autoCppX100, customValue: false };
  return { centsPerPointX100: parsed, customValue: true };
}

/** Dollar value of a balance, in cents. `centsPerPointX100` is cents per point times 100. */
export function balanceValueCents(balance: number, centsPerPointX100: number): number {
  return Math.round((balance * centsPerPointX100) / 100);
}

/** "1.7¢", "0.85¢", "2¢". */
export function formatCpp(centsPerPoint: number): string {
  return `${Number(centsPerPoint.toFixed(2))}¢`;
}

/**
 * Lines like "Alaska Mileage Plan\t55000" or "Amex MR, 270,520" copied from a
 * sheet or typed. Zero and empty balances are skipped.
 */
export function parseBalances(text: string): { program: string; balance: number }[] {
  const out = new Map<string, number>();
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const m = /^(.*?)[\t,:]\s*([\d,]+(?:\.\d+)?)\s*(?:points|pts|miles)?\s*$/i.exec(raw.trim());
    if (!m) continue;
    const balance = Math.round(Number(m[2]!.replace(/,/g, "")));
    const program = normalizeProgram(m[1]!.replace(/[,:\t]+$/, ""));
    if (!program || !balance) continue;
    out.set(program, balance);
  }
  return [...out].map(([program, balance]) => ({ program, balance }));
}

export type RedemptionCheck = {
  /** What each point was worth on this booking, in cents. */
  centsPerPoint: number;
  verdict: "points" | "cash" | "even";
  /** Dollars better (positive) or worse than your usual value for the points, in cents. */
  gainCents: number;
};

/**
 * Is an award worth booking? Cents per point = (cash price − taxes and fees on
 * the award) ÷ points. Compared with what you normally value the points at.
 */
export function checkRedemption(input: {
  cashCents: number;
  points: number;
  feesCents: number;
  valueCentsPerPoint: number;
}): RedemptionCheck | null {
  const { cashCents, points, feesCents, valueCentsPerPoint } = input;
  if (points <= 0 || cashCents <= 0) return null;
  const centsPerPoint = (cashCents - feesCents) / points;
  const gainCents = Math.round(cashCents - feesCents - points * valueCentsPerPoint);
  const verdict =
    Math.abs(centsPerPoint - valueCentsPerPoint) < 0.05
      ? "even"
      : centsPerPoint > valueCentsPerPoint
        ? "points"
        : "cash";
  return { centsPerPoint, verdict, gainCents };
}

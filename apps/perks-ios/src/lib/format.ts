import type { Cadence, MobileOfferGroup, OfferSortKey, RedemptionCheck } from "../types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const CADENCE_OPTIONS: { value: Cadence; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semiannual", label: "Semiannual" },
  { value: "annual", label: "Calendar year" },
  { value: "anniversary", label: "Card year" },
  { value: "quadrennial", label: "Every 4 years" },
  { value: "perk", label: "Ongoing perk" },
];

/** "1st", "2nd", "3rd", "4th", ... */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Format an integer with US thousands commas without allocating Intl.NumberFormat per call. */
export function formatInteger(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format integer cents as "$1,234" or "$12.95". */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const rem = abs % 100;
  const wholeStr = formatInteger(whole);
  const body = rem === 0 ? `$${wholeStr}` : `$${wholeStr}.${String(rem).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/** Format integer cents with explicit + / - prefix when positive or negative. */
export function formatSignedCents(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`;
  return formatCents(cents);
}

/** Convert integer cents to a plain input string ("10" or "12.95"). */
export function centsToInputDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const rem = abs % 100;
  const out = rem === 0 ? String(whole) : `${whole}.${String(rem).padStart(2, "0")}`;
  return cents < 0 ? `-${out}` : out;
}

/** Parse a user-entered dollar string into integer cents, or null if invalid. */
export function parseDollars(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Format "YYYY-MM-DD" as "Nov 15" (same year as reference) or "Nov 15, 2027". */
export function formatDate(iso: string, referenceYear?: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const monthIdx = Number(m) - 1;
  const dayNum = Number(d);
  if (!y || monthIdx < 0 || monthIdx > 11 || !Number.isFinite(dayNum)) return iso;
  const monthName = MONTHS[monthIdx];
  const refYear = referenceYear ? referenceYear.slice(0, 4) : undefined;
  if (refYear && y === refYear) return `${monthName} ${dayNum}`;
  return `${monthName} ${dayNum}, ${y}`;
}

/** Friendly countdown label for days left (0 = "Ends today"). */
export function dueLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (daysLeft < 0) return "Ended";
  if (daysLeft === 0) return "Ends today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

/** Format cents-per-point cleanly ("2¢", "1.7¢", "0.85¢"). */
export function formatCpp(centsPerPoint: number): string {
  return `${Number(centsPerPoint.toFixed(2))}¢`;
}

/** Client-side live "Points or cash?" redemption check. */
export function checkRedemptionClient(input: {
  cashDollars: string;
  pointsText: string;
  feesDollars: string;
  valueCentsPerPoint: number;
}): RedemptionCheck | null {
  const cashCents = parseDollars(input.cashDollars);
  const feesCents = input.feesDollars.trim() ? parseDollars(input.feesDollars) : 0;
  const points = Math.round(Number(input.pointsText.replace(/[,\s]/g, "")));
  if (cashCents === null || cashCents <= 0 || feesCents === null || !Number.isFinite(points)) {
    return null;
  }
  if (points <= 0) return null;
  const centsPerPoint = (cashCents - feesCents) / points;
  const gainCents = Math.round(cashCents - feesCents - points * input.valueCentsPerPoint);
  const verdict =
    Math.abs(centsPerPoint - input.valueCentsPerPoint) < 0.05
      ? "even"
      : centsPerPoint > input.valueCentsPerPoint
        ? "points"
        : "cash";
  return { centsPerPoint, verdict, gainCents };
}

/** Sort offer groups by best return %, biggest dollar reward, or soonest expiry. */
export function sortOfferGroups(
  groups: MobileOfferGroup[],
  sortBy: OfferSortKey,
): MobileOfferGroup[] {
  const copy = [...groups];
  copy.sort((a, b) => {
    if (sortBy === "return") {
      const ra = a.rate ?? -1;
      const rb = b.rate ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.maxCents ?? 0) - (a.maxCents ?? 0);
    }
    if (sortBy === "value") {
      const va = a.maxCents ?? a.valueCents ?? -1;
      const vb = b.maxCents ?? b.valueCents ?? -1;
      if (vb !== va) return vb - va;
      return (b.rate ?? 0) - (a.rate ?? 0);
    }
    const ea = a.expiresOn ?? "9999-99-99";
    const eb = b.expiresOn ?? "9999-99-99";
    if (ea !== eb) return ea.localeCompare(eb);
    return (b.maxCents ?? 0) - (a.maxCents ?? 0);
  });
  return copy;
}

/** Normalize a server base URL (trim whitespace, strip trailing slashes, require http/https). */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) return null;
  return trimmed;
}

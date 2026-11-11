/**
 * Benefit periods. Everything here is pure and works on YYYY-MM-DD strings so
 * it can be unit-tested and never depends on the server's clock or time zone.
 */
export const CADENCES = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "anniversary",
  "quadrennial",
  "perk",
] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABEL: Record<Cadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Twice a year",
  annual: "Calendar year",
  anniversary: "Cardmember year",
  quadrennial: "Every 4 years",
  perk: "Ongoing perk",
};

export type Period = { key: string; start: string; end: string; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function isCadence(value: string): value is Cadence {
  return (CADENCES as readonly string[]).includes(value);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** The anniversary of `openedOn` in `year`, clamping Feb 29 to Feb 28. */
function anniversaryIn(openedOn: string, year: number): string {
  const [, m, d] = parts(openedOn);
  return iso(year, m, Math.min(d, lastDay(year, m)));
}

function calendarPeriod(cadence: Cadence, y: number, index: number): Period {
  switch (cadence) {
    case "monthly":
      return {
        key: `${y}-${pad(index + 1)}`,
        start: iso(y, index + 1, 1),
        end: iso(y, index + 1, lastDay(y, index + 1)),
        label: `${MONTHS[index]} ${y}`,
      };
    case "quarterly": {
      const end = index * 3 + 3;
      return {
        key: `${y}-Q${index + 1}`,
        start: iso(y, index * 3 + 1, 1),
        end: iso(y, end, lastDay(y, end)),
        label: `Q${index + 1} ${y}`,
      };
    }
    case "semiannual": {
      const end = index * 6 + 6;
      return {
        key: `${y}-H${index + 1}`,
        start: iso(y, index * 6 + 1, 1),
        end: iso(y, end, lastDay(y, end)),
        label: `${index === 0 ? "Jan–Jun" : "Jul–Dec"} ${y}`,
      };
    }
    default:
      return { key: `${y}`, start: iso(y, 1, 1), end: iso(y, 12, 31), label: `${y}` };
  }
}

/** How many periods a cadence has per calendar year (0 for untracked perks). */
export function periodsPerYear(cadence: Cadence): number {
  return {
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
    anniversary: 1,
    quadrennial: 0.25,
    perk: 0,
  }[cadence];
}

/** The period containing `today`, or null for perks, which have no deadline. */
export function currentPeriod(
  cadence: Cadence,
  today: string,
  openedOn?: string | null,
): Period | null {
  const [y, m] = parts(today);
  switch (cadence) {
    case "perk":
      return null;
    case "monthly":
      return calendarPeriod(cadence, y, m - 1);
    case "quarterly":
      return calendarPeriod(cadence, y, Math.floor((m - 1) / 3));
    case "semiannual":
      return calendarPeriod(cadence, y, m <= 6 ? 0 : 1);
    case "annual":
      return calendarPeriod(cadence, y, 0);
    case "anniversary": {
      if (!openedOn) return calendarPeriod("annual", y, 0);
      const startYear = anniversaryIn(openedOn, y) <= today ? y : y - 1;
      const start = anniversaryIn(openedOn, startYear);
      const end = addDays(anniversaryIn(openedOn, startYear + 1), -1);
      return { key: `A${startYear}`, start, end, label: `Card year to ${formatDate(end)}` };
    }
    case "quadrennial": {
      // Four-year blocks counted from the year the card was opened.
      const base = openedOn ? parts(openedOn)[0] : 2024;
      const startYear = base + Math.floor((y - base) / 4) * 4;
      return {
        key: `Q${startYear}`,
        start: iso(startYear, 1, 1),
        end: iso(startYear + 3, 12, 31),
        label: `${startYear}–${startYear + 3}`,
      };
    }
  }
}

/**
 * Every period of the calendar year containing `today`, for the usage grid.
 * Cadences that do not follow the calendar return just their current period.
 */
export function periodsThisYear(
  cadence: Cadence,
  today: string,
  openedOn?: string | null,
): Period[] {
  const [y] = parts(today);
  const n =
    cadence === "monthly" ? 12 : cadence === "quarterly" ? 4 : cadence === "semiannual" ? 2 : 0;
  if (n > 0) return Array.from({ length: n }, (_, i) => calendarPeriod(cadence, y, i));
  const current = currentPeriod(cadence, today, openedOn);
  return current ? [current] : [];
}

/** Short label for a period chip in the usage grid. */
export function shortLabel(cadence: Cadence, period: Period): string {
  if (cadence === "monthly") return MONTHS[Number(period.key.slice(5)) - 1]!;
  if (cadence === "quarterly") return period.key.slice(5);
  if (cadence === "semiannual") return period.key.endsWith("H1") ? "Jan–Jun" : "Jul–Dec";
  return period.label;
}

/** "Nov 30" in the current year, "Mar 1, 2027" otherwise. */
export function formatDate(date: string, today?: string): string {
  const [y, m, d] = parts(date);
  const sameYear = today ? parts(today)[0] === y : false;
  return `${MONTHS[m - 1]} ${d}${sameYear ? "" : `, ${y}`}`;
}

/** Next date the annual fee is due: the next anniversary on or after today. */
export function nextAnniversary(openedOn: string, today: string): string {
  const [y] = parts(today);
  const thisYear = anniversaryIn(openedOn, y);
  return thisYear >= today ? thisYear : anniversaryIn(openedOn, y + 1);
}

/** Today's date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

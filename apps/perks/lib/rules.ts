import { addDays, formatDate } from "./periods";

/**
 * Issuer application rules, from card history. These are the widely reported
 * rules of thumb, not published policy: they explain likely denials, they do
 * not guarantee approvals.
 */
export type RuleCard = {
  name: string;
  issuer: string;
  business: boolean;
  openedOn: string | null;
};

export type RuleResult = {
  id: string;
  title: string;
  detail: string;
  /** clear: fine to apply. wait: likely denied until `until`. */
  status: "clear" | "wait";
  until?: string;
};

const opened = (c: RuleCard): c is RuleCard & { openedOn: string } => Boolean(c.openedOn);
const isIssuer = (re: RegExp) => (c: RuleCard) => re.test(c.issuer);
const monthsAgo = (today: string, months: number) => {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1 - months, d));
  return date.toISOString().slice(0, 10);
};
const plusMonths = (date: string, months: number) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
};

/**
 * "At most `limit` cards from this group opened after `since`". When over,
 * the wait ends once enough of them age out of the window.
 */
function windowRule(
  cards: RuleCard[],
  today: string,
  windowStart: string,
  limit: number,
  ageOut: (openedOn: string) => string,
) {
  const inWindow = cards
    .filter(opened)
    .filter((c) => c.openedOn > windowStart && c.openedOn <= today)
    .sort((a, b) => a.openedOn.localeCompare(b.openedOn));
  const count = inWindow.length;
  if (count < limit) return { count, until: undefined };
  // Applying needs count to drop to limit - 1: the oldest (count - limit + 1) must age out.
  const blocker = inWindow[count - limit]!;
  return { count, until: ageOut(blocker.openedOn) };
}

export function applicationRules(cards: RuleCard[], today: string): RuleResult[] {
  const results: RuleResult[] = [];
  const add = (
    id: string,
    title: string,
    limit: number,
    r: { count: number; until?: string },
    describe: (count: number) => string,
  ) =>
    results.push({
      id,
      title,
      status: r.until ? "wait" : "clear",
      until: r.until,
      detail: `${describe(r.count)}${r.until ? ` Clear from ${formatDate(r.until, today)}.` : ""}`,
    });

  // Chase 5/24: personal cards from any bank opened in the last 24 months.
  const personal = cards.filter((c) => !c.business);
  const r524 = windowRule(personal, today, monthsAgo(today, 24), 5, (d) => plusMonths(d, 24));
  add(
    "chase-524",
    "Chase 5/24",
    5,
    r524,
    (n) =>
      `${n} personal card${n === 1 ? "" : "s"} from any bank in the last 24 months; Chase usually declines at 5.`,
  );

  const chase = cards.filter(isIssuer(/chase/i));
  const r130 = windowRule(chase, today, addDays(today, -30), 1, (d) => addDays(d, 30));
  add(
    "chase-130",
    "Chase 1/30",
    1,
    r130,
    (n) =>
      `${n} Chase card${n === 1 ? "" : "s"} in the last 30 days; Chase rarely approves two within 30 days.`,
  );

  const amex = cards.filter(isIssuer(/american express|amex/i));
  const r290 = windowRule(amex, today, addDays(today, -90), 2, (d) => addDays(d, 90));
  add(
    "amex-290",
    "Amex 2/90",
    2,
    r290,
    (n) =>
      `${n} Amex credit card${n === 1 ? "" : "s"} in the last 90 days; Amex limits new credit cards to 2 per 90 days.`,
  );

  const citi = cards.filter(isIssuer(/citi/i));
  const r18 = windowRule(citi, today, addDays(today, -8), 1, (d) => addDays(d, 8));
  add(
    "citi-18",
    "Citi 1/8",
    1,
    r18,
    (n) => `${n} Citi card${n === 1 ? "" : "s"} in the last 8 days.`,
  );
  const r265 = windowRule(citi, today, addDays(today, -65), 2, (d) => addDays(d, 65));
  add(
    "citi-265",
    "Citi 2/65",
    2,
    r265,
    (n) => `${n} Citi card${n === 1 ? "" : "s"} in the last 65 days.`,
  );

  const capOne = cards.filter(isIssuer(/capital one/i));
  const r16 = windowRule(capOne, today, monthsAgo(today, 6), 1, (d) => plusMonths(d, 6));
  add(
    "capone-16",
    "Capital One 1/6",
    1,
    r16,
    (n) => `${n} Capital One card${n === 1 ? "" : "s"} in the last 6 months.`,
  );

  // Bank of America 2/3/4: 2 per 2 months, 3 per 12, 4 per 24.
  const bofa = cards.filter(isIssuer(/bank of america|bofa/i));
  const b2 = windowRule(bofa, today, monthsAgo(today, 2), 2, (d) => plusMonths(d, 2));
  const b3 = windowRule(bofa, today, monthsAgo(today, 12), 3, (d) => plusMonths(d, 12));
  const b4 = windowRule(bofa, today, monthsAgo(today, 24), 4, (d) => plusMonths(d, 24));
  const until = [b2.until, b3.until, b4.until]
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  add(
    "bofa-234",
    "Bank of America 2/3/4",
    0,
    { count: b4.count, until },
    () => `${b2.count} in 2 months, ${b3.count} in 12, ${b4.count} in 24; limits are 2, 3 and 4.`,
  );
  return results;
}

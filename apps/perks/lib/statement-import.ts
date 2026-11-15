import { parseDelimited, parseSheetDate } from "./sheet-import";

/**
 * Finds statement credits in a transactions CSV downloaded from a card issuer
 * (Amex, Chase and most others). Issuers disagree on whether charges are
 * positive or negative, and on the exact wording of credit lines, so this
 * works from the shape of the file: the sign most purchases carry marks a
 * charge, and rows with the opposite sign that are not bill payments are
 * credits. The owner then confirms which benefit each credit belongs to.
 */
export type StatementCredit = {
  date: string;
  description: string;
  /** Always positive. */
  amountCents: number;
};

export type StatementParse = {
  credits: StatementCredit[];
  /** Rows read as purchases, to confirm the right file was chosen. */
  charges: number;
  error?: string;
};

const PAYMENT = /\b(payment|autopay|auto-pay|thank you|pymt|online pmt|balance transfer)\b/i;

function cents(value: string): number | null {
  const negative = /^\(.*\)$/.test(value.trim()) || value.trim().startsWith("-");
  const cleaned = value.replace(/[()$,\s+-]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Math.round(Number(cleaned) * 100);
  return negative ? -n : n;
}

export function parseStatementCsv(text: string): StatementParse {
  const delimiter = text.split("\n", 1)[0]!.includes("\t") ? "\t" : ",";
  const rows = parseDelimited(text, delimiter);
  const headerIndex = rows.findIndex((r) => {
    const cells = r.map((c) => c.toLowerCase());
    return (
      cells.some((c) => c.includes("date")) &&
      cells.includes("amount") &&
      cells.some((c) => c.includes("description"))
    );
  });
  if (headerIndex < 0) {
    return {
      credits: [],
      charges: 0,
      error:
        "This doesn't look like a transactions file. It needs Date, Description and Amount columns.",
    };
  }
  const header = rows[headerIndex]!.map((c) => c.toLowerCase());
  const dateCol = Math.max(
    header.indexOf("transaction date"),
    header.indexOf("date"),
    header.findIndex((c) => c.includes("date")),
  );
  const descCol =
    header.indexOf("description") >= 0
      ? header.indexOf("description")
      : header.findIndex((c) => c.includes("description"));
  const amountCol = header.indexOf("amount");
  const typeCol = header.indexOf("type");

  const parsed: { date: string; description: string; amount: number; type: string }[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const date = parseSheetDate(row[dateCol] ?? "");
    const amount = cents(row[amountCol] ?? "");
    const description = (row[descCol] ?? "").replace(/\s+/g, " ").trim();
    if (!date || amount === null || amount === 0 || !description) continue;
    parsed.push({
      date,
      description,
      amount,
      type: (typeCol >= 0 ? (row[typeCol] ?? "") : "").toLowerCase(),
    });
  }
  const purchases = parsed.filter((r) => !PAYMENT.test(r.description));
  if (purchases.length === 0)
    return { credits: [], charges: 0, error: "No transactions found below the header." };

  const chargeSign = detectChargeSign(purchases);
  const credits = purchases
    .filter((r) => Math.sign(r.amount) !== chargeSign)
    .map((r) => ({ date: r.date, description: r.description, amountCents: Math.abs(r.amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { credits, charges: purchases.length - credits.length };
}

const CREDITISH = /\b(credit|refund|return|reversal|adjustment)\b/i;

/**
 * Which sign a purchase carries in this file. Strongest signal first: a Type
 * column ("Sale"), then lines that call themselves credits or refunds, then
 * whichever sign most rows have, since purchases usually outnumber credits.
 */
function detectChargeSign(rows: { description: string; amount: number; type: string }[]): 1 | -1 {
  const vote = (list: { amount: number }[]) => list.reduce((n, r) => n + Math.sign(r.amount), 0);
  const sales = vote(rows.filter((r) => r.type === "sale" || r.type === "purchase"));
  if (sales !== 0) return sales > 0 ? 1 : -1;
  const creditish = vote(
    rows.filter((r) => CREDITISH.test(r.description) || CREDITISH.test(r.type)),
  );
  if (creditish !== 0) return creditish > 0 ? -1 : 1;
  return vote(rows) >= 0 ? 1 : -1;
}

/** Words too generic to tie a credit line to one benefit. */
const STOP = new Set([
  "credit",
  "credits",
  "cash",
  "membership",
  "the",
  "and",
  "a",
  "of",
  "plus",
  "statement",
  "annual",
  "fee",
  "per",
  "select",
  "only",
  "for",
  "card",
  "business",
  "monthly",
  "hotels",
  "first",
  "after",
  "spend",
  "with",
  "your",
  "free",
  "night",
  "certificate",
  "category",
]);

/** Extra spellings issuers use for the same merchants. */
const ALIASES: Record<string, string[]> = {
  hotel: ["fhr", "fine hotels", "hotel collection", "amex travel", "amextravel"],
  travel: ["travel"],
  edit: ["the edit"],
  entertainment: [
    "digital entertainment",
    "disney",
    "hulu",
    "espn",
    "peacock",
    "nytimes",
    "new york times",
    "wsj",
    "paramount",
    "youtube",
  ],
  wireless: ["wireless", "verizon", "t-mobile", "tmobile", "at&t", "att"],
  airline: ["airline", "incidental"],
  dining: ["dining", "grubhub", "five guys", "cheesecake", "goldbelly", "wine.com"],
  walmart: ["walmart"],
  clear: ["clear"],
  stubhub: ["stubhub", "viagogo"],
  chatgpt: ["chatgpt", "openai"],
  flexible: ["grubhub", "office", "staples", "office depot", "ups"],
};

function keywords(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/\(.*?\)/g, (m) => ` ${m.slice(1, -1)} `)
    .split(/[^a-z0-9+&.']+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return [...new Set(words.flatMap((w) => [w, ...(ALIASES[w] ?? [])]))];
}

/** Whole-word match, so "edit" does not match inside "credit". */
function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

/**
 * Best-guess benefit for a credit line: the one whose name shares the most
 * distinctive words with the description. Null when nothing matches, which
 * is the right answer for ordinary merchant refunds.
 */
export function suggestBenefit<T extends { id: string; name: string }>(
  description: string,
  benefits: T[],
): T | null {
  const text = description.toLowerCase();
  let best: T | null = null;
  let bestScore = 0;
  for (const b of benefits) {
    const score = keywords(b.name).reduce((n, k) => n + (hasWord(text, k) ? k.length : 0), 0);
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

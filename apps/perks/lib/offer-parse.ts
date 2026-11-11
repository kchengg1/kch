import { addDays } from "./periods";

/**
 * Turns text copied from an Amex Offers or Chase Offers page into structured
 * offers. Neither bank has an API, and the pages differ and change, so this
 * is a tolerant heuristic: each offer is a small block of lines holding a
 * merchant, a deal ("Spend $80 or more, get $15 back") and usually an expiry.
 */
export type ParsedOffer = {
  merchant: string;
  details: string;
  /** Largest dollar reward named in the deal, in cents. */
  valueCents: number | null;
  expiresOn: string | null;
  /** True when the page shows the offer as already added to the card. */
  added: boolean;
};

const NOISE =
  /^(add(ed)? to card|add offer|added|view (details|offer)|terms( apply| & conditions)?|details|new|offer details|shop now|activate|activated|save offer|saved|expiring soon|featured|recommended offers?|available offers?|added to card offers?|in-store|online|online only|in-store & online|\+|\d+)$/i;
const ADDED = /^(added( to card)?|activated|saved)$/i;
const DEAL =
  /(spend \$|get \$|earn |\$\s?\d[\d,.]* (back|off|cash back|statement credit)|\d+(\.\d+)?% (cash )?back|\d+x\b|points? per|membership rewards|cash back)/i;
const EXPIRY =
  /(?:exp(?:ires?|\.)?|ends?|valid (?:through|until)|through)\s*(?:on\s*)?:?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?|(\d+)\s*d(?:ays?)?\s*left|expires\s+in\s+(\d+)\s+days?|expires\s+(today|tomorrow)|(?:exp(?:ires?)?|ends?)\s+([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function expiryFrom(line: string, today: string): string | null {
  const m = EXPIRY.exec(line);
  if (!m) return null;
  const year = Number(today.slice(0, 4));
  const build = (y: number, mo: number, d: number) => {
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCMonth() !== mo - 1) return null;
    return date.toISOString().slice(0, 10);
  };
  // A date without a year that has already passed means next year.
  const rollForward = (mo: number, d: number) => {
    const thisYear = build(year, mo, d);
    return thisYear && thisYear < today ? build(year + 1, mo, d) : thisYear;
  };
  if (m[1] && m[2]) {
    if (!m[3]) return rollForward(Number(m[1]), Number(m[2]));
    const y = Number(m[3]);
    return build(y < 100 ? 2000 + y : y, Number(m[1]), Number(m[2]));
  }
  if (m[4]) return addDays(today, Number(m[4]));
  if (m[5]) return addDays(today, Number(m[5]));
  if (m[6]) return m[6].toLowerCase() === "today" ? today : addDays(today, 1);
  if (m[7] && m[8]) {
    const mo = MONTHS.indexOf(m[7].slice(0, 3).toLowerCase()) + 1;
    if (mo === 0) return null;
    return m[9] ? build(Number(m[9]), mo, Number(m[8])) : rollForward(mo, Number(m[8]));
  }
  return null;
}

/** "$15 back", "get $30", "up to a total of $50" → the largest dollar reward. */
function rewardCents(details: string): number | null {
  const rewards = [
    ...details.matchAll(
      /(?:get|earn|total of|up to)\s+(?:a\s+)?(?:total of\s+)?\$\s?([\d,]+(?:\.\d{1,2})?)/gi,
    ),
    ...details.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)\s+(?:back|off|cash back|statement credit)/gi),
  ].map((m) => Math.round(Number(m[1]!.replace(/,/g, "")) * 100));
  return rewards.length ? Math.max(...rewards) : null;
}

export function parseOffers(text: string, today: string): ParsedOffer[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Split into blocks. An expiry line closes the offer it belongs to; when a
  // page lists no expiry at all, a second deal line starts the next offer.
  const blocks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) blocks.push(current);
    current = [];
  };
  for (const line of lines) {
    const isExpiry = EXPIRY.test(line);
    // Buttons and status lines printed under an expiry belong to that offer.
    if (current.length === 0 && blocks.length > 0 && (NOISE.test(line) || ADDED.test(line))) {
      blocks[blocks.length - 1]!.push(line);
      continue;
    }
    if (!isExpiry && DEAL.test(line) && current.some((l) => DEAL.test(l))) {
      // The merchant of the next offer may already sit at the end of this block.
      const carried: string[] = [];
      while (current.length) {
        const last = current[current.length - 1]!;
        if (DEAL.test(last) || ADDED.test(last) || NOISE.test(last)) break;
        carried.unshift(current.pop()!);
      }
      flush();
      current = carried;
    }
    current.push(line);
    if (isExpiry) {
      blocks.push(current);
      current = [];
    }
  }
  // Trailing "Add to Card" style lines belong to the offer above them.
  if (current.length && !current.some((l) => DEAL.test(l)) && blocks.length) {
    blocks[blocks.length - 1]!.push(...current);
    current = [];
  }
  flush();

  const offers: ParsedOffer[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const expiryLine = block.find((l) => EXPIRY.test(l));
    const deals = block.filter((l) => DEAL.test(l) && l !== expiryLine);
    const names = block.filter((l) => !DEAL.test(l) && l !== expiryLine && !NOISE.test(l));
    if (deals.length === 0 || names.length === 0) continue;
    const offer: ParsedOffer = {
      merchant: names[0]!.slice(0, 120),
      details: deals.join(" ").slice(0, 300),
      valueCents: rewardCents(deals.join(" ")),
      expiresOn: expiryLine ? expiryFrom(expiryLine, today) : null,
      added: block.some((l) => ADDED.test(l)),
    };
    const key = offerKey(offer);
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push(offer);
  }
  return offers;
}

/** Identity used to skip offers that were already saved. */
export function offerKey(o: {
  merchant: string;
  details: string;
  expiresOn: string | null;
}): string {
  return `${o.merchant.toLowerCase()}|${o.details.toLowerCase()}|${o.expiresOn ?? ""}`;
}

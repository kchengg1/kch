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
  /(\bspend \$|\bget \$|\bearn |\$\s?\d[\d,.]* (back|off|cash back|statement credit)|\d+(\.\d+)?% (cash )?back|\d+x\b|points? per|membership rewards|cash back)/i;
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
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) =>
      l
        // Some browsers copy links as Markdown: "[View All](https://...)".
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        // List bullets copied from the page.
        .replace(/^\s*[*\u2022-]\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const lines = unglue(cleaned);
  return lines.some((l) => EXPIRY.test(l))
    ? parseAnchored(lines, today)
    : parseByBlocks(lines, today);
}

/** A Chase deal on its own: "10% cash back", "Up to 5% back", "$20 cash back". */
const BARE_DEAL = /^(?:up to )?(?:\$\s?[\d,]+(?:\.\d{1,2})?|\d+(?:\.\d+)?%) (?:cash )?back$/i;

/**
 * Chase copies each offer tile as one run-together line: badge, merchant,
 * deal and status, e.g. "NewHyatt Essentials10% cash backExpiring soon".
 * Returns [merchant, deal, ...status], or null when the line is not glued.
 * The merchant must butt right up against the deal (no space), which keeps
 * ordinary deal sentences like "Spend $50, get $10 back" whole.
 */
function splitGlued(line: string): string[] | null {
  const tail = /expiring soon$/i.exec(line);
  const body = tail ? line.slice(0, tail.index) : line;
  if (!/back$/i.test(body)) return null;
  for (let i = 1; i < body.length; i++) {
    const merchant = body.slice(0, i);
    const deal = body.slice(i);
    if (/\s$/.test(merchant) || !BARE_DEAL.test(deal)) continue;
    // "Studio 5410% back" is Studio 54 at 10%, not Studio at 5410%.
    const pct = /(\d+(?:\.\d+)?)%/.exec(deal);
    if (pct && Number(pct[1]) > 100) continue;
    if (DEAL.test(merchant) || NOISE.test(merchant)) return null;
    return tail ? [merchant, deal, "Expiring soon"] : [merchant, deal];
  }
  return null;
}

/** Splits glued Chase tiles into separate merchant and deal lines. */
function unglue(lines: string[]): string[] {
  const split = lines.map(splitGlued);
  const merchants = split.flatMap((s) => (s ? [s[0]!] : []));
  // Chase prefixes unseen offers with a "New" badge that copies as part of
  // the name ("NewLyft", "NeweBay"). Strip it when most tiles carry it, so a
  // real "New Balance" tile ("NewNew Balance") still keeps its name.
  const badged = merchants.filter((m) => /^New\S/.test(m)).length;
  const stripNew = merchants.length > 0 && badged * 2 >= merchants.length;
  return lines.flatMap((line, i) => {
    const parts = split[i];
    if (!parts) return [line];
    const [merchant, ...rest] = parts;
    const name = stripNew && /^New\S/.test(merchant!) ? merchant!.slice(3) : merchant!;
    return [name, ...rest];
  });
}

/** Lines that can never be a merchant name. */
const NOT_MERCHANT = (line: string) =>
  NOISE.test(line) || ADDED.test(line) || DEAL.test(line) || EXPIRY.test(line);

/** Heading of the box listing offers already added, e.g. "Added to Card (2)". */
const ADDED_HEADING = /^added to card \(\d+\)$/i;
/** Headings that close that box. */
const SECTION_END =
  /^(recommended offers|available offers|all offers|new offers|saved from offers|explore local offers)\b/i;

/** Which lines sit inside the "Added to Card" box. */
function addedSection(lines: string[]): boolean[] {
  let inside = false;
  return lines.map((line, i) => {
    const heading =
      ADDED_HEADING.test(line) ||
      (/^added to card$/i.test(line) && /^view all\b/i.test(lines[i + 1] ?? ""));
    if (heading) inside = true;
    else if (SECTION_END.test(line)) inside = false;
    return inside;
  });
}

/**
 * Pages that date every offer (Amex, Chase): each offer is the deal line
 * nearest above an expiry line, and the merchant is the nearest plain line
 * above that deal. Page headers, footers and the ads Amex mixes into the
 * list carry no expiry, so they are never picked up. Offers in the "Added
 * to Card" box show only a name and expiry, so there the deal is optional.
 */
function parseAnchored(lines: string[], today: string): ParsedOffer[] {
  const expiries = lines.flatMap((l, i) => (EXPIRY.test(l) ? [i] : []));
  const inAdded = addedSection(lines);
  const found: ParsedOffer[] = [];
  expiries.forEach((at, n) => {
    const from = n === 0 ? 0 : expiries[n - 1]! + 1;
    let dealAt = -1;
    for (let i = at - 1; i >= from; i--) {
      if (DEAL.test(lines[i]!)) {
        dealAt = i;
        break;
      }
    }
    if (dealAt < 0 && !inAdded[at]) return;
    let merchantAt = -1;
    for (let i = (dealAt < 0 ? at : dealAt) - 1; i >= from; i--) {
      if (!NOT_MERCHANT(lines[i]!)) {
        merchantAt = i;
        break;
      }
    }
    // Some pages print the deal before the merchant.
    if (merchantAt < 0 && dealAt >= 0) {
      for (let i = dealAt + 1; i < at; i++) {
        if (!NOT_MERCHANT(lines[i]!)) {
          merchantAt = i;
          break;
        }
      }
    }
    if (merchantAt < 0) return;
    // Status labels sit beside the offer: between merchant and expiry, or just after it.
    const next = expiries[n + 1] ?? lines.length;
    const status = [
      ...lines.slice(dealAt < 0 ? merchantAt : Math.min(merchantAt, dealAt), at),
      ...lines.slice(at + 1, Math.min(at + 4, next)),
    ];
    const details = dealAt < 0 ? "" : lines[dealAt]!.slice(0, 300);
    found.push({
      merchant: lines[merchantAt]!.slice(0, 120),
      details,
      valueCents: rewardCents(details),
      expiresOn: expiryFrom(lines[at]!, today),
      added: inAdded[at]! || status.some((l) => ADDED.test(l)),
    });
  });

  // The same offer can be listed twice: in the "Added to Card" box (no deal
  // text) and in the full list. Keep one, with the deal text and added flag.
  const byOffer = new Map<string, ParsedOffer>();
  for (const offer of found) {
    const key = `${offer.merchant.toLowerCase()}|${offer.expiresOn ?? ""}`;
    const prior = byOffer.get(key);
    if (!prior) byOffer.set(key, offer);
    else if (!prior.details || prior.details === offer.details) {
      byOffer.set(key, {
        ...offer,
        details: offer.details || prior.details,
        added: prior.added || offer.added,
      });
    } else {
      // Two different deals at one merchant: keep both.
      byOffer.set(`${key}|${offer.details.toLowerCase()}`, offer);
    }
  }
  return [...byOffer.values()];
}

/** Fallback for pages without expiry dates: group lines into offers by their deal lines. */
function parseByBlocks(lines: string[], today: string): ParsedOffer[] {
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
    const isName = (l: string) =>
      !DEAL.test(l) && l !== expiryLine && !NOISE.test(l) && !ADDED.test(l);
    if (deals.length === 0) continue;
    // The merchant is the name closest above the deal. The first block also
    // holds the page header and filter menu ("Skip to main content", "Added
    // to card"), so its first line is not the merchant.
    const dealAt = block.findIndex((l) => DEAL.test(l) && l !== expiryLine);
    let merchantAt = -1;
    for (let i = dealAt - 1; i >= 0; i--) {
      if (isName(block[i]!)) {
        merchantAt = i;
        break;
      }
    }
    // Some pages print the deal before the merchant.
    if (merchantAt < 0) merchantAt = block.findIndex((l, i) => i > dealAt && isName(l));
    if (merchantAt < 0) continue;
    const offer: ParsedOffer = {
      merchant: block[merchantAt]!.slice(0, 120),
      details: deals.join(" ").slice(0, 300),
      valueCents: rewardCents(deals.join(" ")),
      expiresOn: expiryLine ? expiryFrom(expiryLine, today) : null,
      added: block.slice(Math.min(merchantAt, dealAt)).some((l) => ADDED.test(l)),
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

const GENERIC_CARD_WORDS = new Set([
  "amex",
  "american",
  "express",
  "chase",
  "card",
  "credit",
  "charge",
  "the",
  "from",
  "by",
  "personal",
  "rewards",
  "reward",
]);

const CARD_LINE_HINT = /\b(card|american express|amex|chase|ending in)\b|\.\.\.\d{4}\b|-\d{4,5}\b/i;

function normalizeForCardMatch(value: string): string {
  return value
    .replace(/[®™℠]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cardTokens(name: string): string[] {
  return normalizeForCardMatch(name)
    .split(" ")
    .filter((w) => w.length > 0 && !GENERIC_CARD_WORDS.has(w));
}

function containsTokensInOrder(lineWords: string[], tokens: string[]): boolean {
  let idx = 0;
  for (const word of lineWords) {
    if (word === tokens[idx]) {
      idx++;
      if (idx === tokens.length) return true;
    }
  }
  return false;
}

/**
 * Try to match a pasted Amex/Chase offers page to one of the user's cards by
 * scanning the page text for the card's distinctive product name. Returns the
 * matching card id only when there is a unique best match.
 */
export function detectCardFromOffersText(
  text: string,
  cards: { id: string; name: string }[],
): string | null {
  if (!text.trim() || cards.length === 0) return null;
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return null;

  const prepared = cards
    .map((c) => {
      const tokens = cardTokens(c.name);
      return {
        id: c.id,
        tokens,
        charScore: tokens.reduce((sum, t) => sum + t.length, 0),
      };
    })
    .filter((c) => c.tokens.length > 0);

  const matchInLines = (lines: string[]): string | null => {
    let bestId: string | null = null;
    let bestTokenCount = 0;
    let bestCharScore = 0;
    let tied = false;

    for (const c of prepared) {
      let matched = false;
      for (const rawLine of lines) {
        if (c.tokens.length === 1 && !CARD_LINE_HINT.test(rawLine)) continue;
        const words = normalizeForCardMatch(rawLine).split(" ").filter(Boolean);
        if (containsTokensInOrder(words, c.tokens)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      if (
        c.tokens.length > bestTokenCount ||
        (c.tokens.length === bestTokenCount && c.charScore > bestCharScore)
      ) {
        bestId = c.id;
        bestTokenCount = c.tokens.length;
        bestCharScore = c.charScore;
        tied = false;
      } else if (c.tokens.length === bestTokenCount && c.charScore === bestCharScore) {
        tied = true;
      }
    }
    return tied ? null : bestId;
  };

  // Amex and Chase display the active card name near the top of the page.
  return matchInLines(rawLines.slice(0, 50)) ?? matchInLines(rawLines.slice(50));
}

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
 * Mirror of `detectCardFromOffersText` in `apps/perks/lib/offer-parse.ts`.
 * Scans pasted Amex/Chase offers text to auto-select the matching card when
 * there is a unique best match.
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

  return matchInLines(rawLines.slice(0, 50)) ?? matchInLines(rawLines.slice(50));
}

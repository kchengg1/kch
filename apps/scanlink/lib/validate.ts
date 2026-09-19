/**
 * Pure helpers (no Node-only imports) so they run in tests and on the edge.
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Short, URL-safe, unguessable public id for a code. */
export function generateSlug(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * Turn user input into an absolute http(s) URL, or null when it is not usable.
 * "example.com/menu" becomes "https://example.com/menu".
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  // "mailto:x" has a scheme; "localhost:3000" and "example.com:8080/x" do not (port follows the colon).
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitterbot|linkedin|skype|curl|wget|python-requests|headless/i;

/** Link previews and crawlers hit the redirect too; keep them out of the stats. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_PATTERN.test(userAgent);
}

/** Truncate long URLs for display. */
export function shortenUrl(url: string, max = 48): string {
  const bare = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare;
}

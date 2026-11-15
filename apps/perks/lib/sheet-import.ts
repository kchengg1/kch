import { matchTemplate } from "./catalog";

/**
 * Reads the "Credit Cards" tab of a churning spreadsheet pasted straight from
 * Google Sheets or Excel (tab-separated, header row included).
 */
export type ImportedCard = {
  name: string;
  issuer: string;
  templateKey: string | null;
  business: boolean;
  annualFeeCents: number;
  openedOn: string | null;
  closedOn: string | null;
  closed: boolean;
};

/** Split pasted spreadsheet text into rows of cells, honouring quoted cells. */
export function parseTsv(text: string): string[][] {
  return parseDelimited(text, "\t");
}

/** Split delimited text (CSV, TSV) into rows of trimmed cells, honouring quoted cells. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

/** "3/1/2025", "03/01/25" or "2025-03-01" to YYYY-MM-DD. Null when unparseable. */
export function parseSheetDate(value: string): string | null {
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value);
  let y: number, m: number, d: number;
  if (isoMatch) [y, m, d] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])];
  else if (usMatch) {
    [m, d, y] = [Number(usMatch[1]), Number(usMatch[2]), Number(usMatch[3])];
    if (y < 100) y += 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const money = (value: string) => {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export function parseCardSheet(text: string): { cards: ImportedCard[]; error?: string } {
  const rows = parseTsv(text);
  const headerIndex = rows.findIndex((r) => r.some((c) => /^card name$/i.test(c)));
  if (headerIndex < 0) return parseCardList(text);
  const header = rows[headerIndex]!.map((c) => c.toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    name: col("card name"),
    opened: col("approval date", "opened", "open date"),
    closedOn: col("closed/pc date", "closed date"),
    fee: col("annual fee"),
    bank: col("bank"),
    type: col("card type"),
    closed: col("closed"),
  };
  const at = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "") : "");

  const cards: ImportedCard[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const name = at(row, idx.name);
    if (!name) continue;
    const template = matchTemplate(name);
    const closedOn = parseSheetDate(at(row, idx.closedOn));
    const closed = /^(yes|y|true)$/i.test(at(row, idx.closed));
    cards.push({
      name,
      issuer: template?.issuer ?? at(row, idx.bank),
      templateKey: template?.key ?? null,
      // Trust the catalog over the sheet: a mistyped "Personal" would otherwise
      // inflate the 5/24 count.
      business:
        template?.business ??
        (/^business$/i.test(at(row, idx.type)) || /\b(business|biz)\b/i.test(name)),
      // Sheets go stale after fee increases, so a known product uses the current fee.
      annualFeeCents: template ? template.annualFee * 100 : money(at(row, idx.fee)),
      openedOn: parseSheetDate(at(row, idx.opened)),
      // A product change keeps the account open, so its date is not a closure.
      closedOn: closed ? closedOn : null,
      closed,
    });
  }
  if (cards.length === 0) return { cards, error: "No card rows found below the header." };
  return { cards };
}

/** "3/2024" or "2024-03" (month and year only) to the first of that month. */
function parseMonthYear(value: string): string | null {
  const us = /^(\d{1,2})\/(\d{2,4})$/.exec(value);
  const iso = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (us) return parseSheetDate(`${us[1]}/1/${us[2]}`);
  if (iso) return parseSheetDate(`${iso[1]}-${iso[2]}-01`);
  return null;
}

/**
 * A plain list of cards, one per line, as people type them in a message:
 * "Chase Sapphire Pref" or "Chase Sapphire Pref, 3/2024". An opened date is
 * optional after a comma or tab; bullets and numbering are ignored. Every
 * card on such a list is taken to be open.
 */
export function parseCardList(text: string): { cards: ImportedCard[]; error?: string } {
  const cards: ImportedCard[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    const parts = line.split(/\t|,\s*/).map((p) => p.trim());
    const last = parts.length > 1 ? parts[parts.length - 1]! : "";
    const openedOn = last ? (parseSheetDate(last) ?? parseMonthYear(last)) : null;
    const name = (openedOn ? parts.slice(0, -1).join(", ") : line).slice(0, 120);
    if (!name) continue;
    const template = matchTemplate(name);
    cards.push({
      name,
      issuer: template?.issuer ?? "",
      templateKey: template?.key ?? null,
      business: template?.business ?? /\b(business|biz)\b/i.test(name),
      annualFeeCents: (template?.annualFee ?? 0) * 100,
      openedOn,
      closedOn: null,
      closed: false,
    });
  }
  if (cards.length === 0)
    return {
      cards,
      error: "Paste a list of cards, one per line, or the sheet with its header row.",
    };
  return { cards };
}

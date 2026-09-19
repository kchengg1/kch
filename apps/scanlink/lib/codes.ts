import "server-only";
import { and, count, db, desc, eq, gte, qrCode, qrScan, sql, type QrCode } from "@kch/db";
import { generateSlug } from "./validate";

export async function listCodes(userId: string): Promise<QrCode[]> {
  return db.select().from(qrCode).where(eq(qrCode.userId, userId)).orderBy(desc(qrCode.createdAt));
}

export async function countCodes(userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(qrCode).where(eq(qrCode.userId, userId));
  return row?.n ?? 0;
}

export async function getCode(id: string, userId: string): Promise<QrCode | null> {
  const [row] = await db
    .select()
    .from(qrCode)
    .where(and(eq(qrCode.id, id), eq(qrCode.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getCodeBySlug(slug: string): Promise<QrCode | null> {
  const [row] = await db.select().from(qrCode).where(eq(qrCode.slug, slug)).limit(1);
  return row ?? null;
}

export async function createCode(input: {
  userId: string;
  name: string;
  targetUrl: string;
}): Promise<QrCode> {
  // Slugs are random; retry on the (very unlikely) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug(attempt < 3 ? 7 : 9);
    const [row] = await db
      .insert(qrCode)
      .values({ id: crypto.randomUUID(), slug, ...input })
      .onConflictDoNothing({ target: qrCode.slug })
      .returning();
    if (row) return row;
  }
  throw new Error("Could not allocate a unique slug");
}

export async function updateCode(
  id: string,
  userId: string,
  patch: { name?: string; targetUrl?: string },
): Promise<QrCode | null> {
  const [row] = await db
    .update(qrCode)
    .set(patch)
    .where(and(eq(qrCode.id, id), eq(qrCode.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteCode(id: string, userId: string): Promise<void> {
  await db.delete(qrCode).where(and(eq(qrCode.id, id), eq(qrCode.userId, userId)));
}

export type ScanMeta = {
  referer?: string | null;
  userAgent?: string | null;
  country?: string | null;
};

/** Store one scan and bump the denormalised counter. */
export async function recordScan(codeId: string, meta: ScanMeta): Promise<void> {
  await Promise.all([
    db.insert(qrScan).values({
      id: crypto.randomUUID(),
      codeId,
      referer: meta.referer?.slice(0, 512) ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      country: meta.country?.slice(0, 2).toUpperCase() ?? null,
    }),
    db
      .update(qrCode)
      .set({ scanCount: sql`${qrCode.scanCount} + 1` })
      .where(eq(qrCode.id, codeId)),
  ]);
}

/** How many days of daily history the code page charts. */
export const TREND_DAYS = 14;

export type ScanStats = {
  last7: number;
  last30: number;
  /** One entry per day, oldest first, including days with no scans. */
  byDay: { day: string; scans: number }[];
  topSources: { source: string; scans: number }[];
  topCountries: { country: string; scans: number }[];
};

export async function getScanStats(codeId: string): Promise<ScanStats> {
  // Align the windows to UTC day boundaries, the same buckets the daily
  // breakdown uses, so the totals equal the sum of the bars shown.
  const since7 = startOfUtcDayAgo(6);
  const since30 = startOfUtcDayAgo(29);
  const day = sql<string>`to_char(${qrScan.scannedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  // Group by the referring host ("instagram.com"), not the full URL, so the list
  // stays readable and one site does not occupy every row.
  const source = sql<string>`coalesce(
    substring(${qrScan.referer} from '^[a-z]+://(?:www\\.)?([^/?#]+)'),
    'Direct scan'
  )`;
  const country = sql<string>`coalesce(${qrScan.country}, 'Unknown')`;
  const inWindow = and(eq(qrScan.codeId, codeId), gte(qrScan.scannedAt, since30));

  const [[l7], [l30], byDay, topSources, topCountries] = await Promise.all([
    db
      .select({ n: count() })
      .from(qrScan)
      .where(and(eq(qrScan.codeId, codeId), gte(qrScan.scannedAt, since7))),
    db.select({ n: count() }).from(qrScan).where(inWindow),
    db.select({ day, scans: count() }).from(qrScan).where(inWindow).groupBy(day).orderBy(desc(day)),
    db
      .select({ source, scans: count() })
      .from(qrScan)
      .where(inWindow)
      .groupBy(source)
      .orderBy(desc(count()))
      .limit(5),
    db
      .select({ country, scans: count() })
      .from(qrScan)
      .where(inWindow)
      .groupBy(country)
      .orderBy(desc(count()))
      .limit(5),
  ]);

  return {
    last7: l7?.n ?? 0,
    last30: l30?.n ?? 0,
    byDay: fillMissingDays(byDay, TREND_DAYS),
    topSources,
    topCountries,
  };
}

/** Midnight UTC, `daysAgo` days before today. */
function startOfUtcDayAgo(daysAgo: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo));
}

/**
 * The grouped query only returns days that had a scan. Charting those alone
 * hides the quiet days and overstates the trend, so pad the window with zeros
 * and return it oldest-first.
 */
function fillMissingDays(rows: { day: string; scans: number }[], days: number) {
  const counts = new Map(rows.map((r) => [r.day, r.scans]));
  const today = new Date();
  const out: { day: string; scans: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, scans: counts.get(key) ?? 0 });
  }
  return out;
}

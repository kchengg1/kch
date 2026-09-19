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

export type ScanStats = {
  last7: number;
  last30: number;
  byDay: { day: string; scans: number }[];
  topReferers: { referer: string; scans: number }[];
  topCountries: { country: string; scans: number }[];
};

export async function getScanStats(codeId: string): Promise<ScanStats> {
  const now = Date.now();
  const since7 = new Date(now - 7 * 86_400_000);
  const since30 = new Date(now - 30 * 86_400_000);
  const day = sql<string>`to_char(${qrScan.scannedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const referer = sql<string>`coalesce(nullif(${qrScan.referer}, ''), 'Direct / camera app')`;
  const country = sql<string>`coalesce(${qrScan.country}, 'Unknown')`;
  const inWindow = and(eq(qrScan.codeId, codeId), gte(qrScan.scannedAt, since30));

  const [[l7], [l30], byDay, topReferers, topCountries] = await Promise.all([
    db
      .select({ n: count() })
      .from(qrScan)
      .where(and(eq(qrScan.codeId, codeId), gte(qrScan.scannedAt, since7))),
    db.select({ n: count() }).from(qrScan).where(inWindow),
    db.select({ day, scans: count() }).from(qrScan).where(inWindow).groupBy(day).orderBy(desc(day)),
    db
      .select({ referer, scans: count() })
      .from(qrScan)
      .where(inWindow)
      .groupBy(referer)
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

  return { last7: l7?.n ?? 0, last30: l30?.n ?? 0, byDay, topReferers, topCountries };
}

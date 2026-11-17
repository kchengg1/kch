import { and, db, eq, isNull, lt, or, schema, sql } from "@kch/db";

/** Minimum gap between two writes of `lastActiveAt` for the same user. */
export const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

// Per-process memo so a burst of requests doesn't each cost a DB round-trip.
const recentlyTouched = new Map<string, number>();
const MEMO_LIMIT = 5000;

/** True when a write is due, given when we last wrote (ms epoch) and now. */
export function shouldTouch(lastTouchedMs: number | undefined, nowMs: number): boolean {
  return lastTouchedMs === undefined || nowMs - lastTouchedMs >= ACTIVITY_THROTTLE_MS;
}

/**
 * Record that a user was just active. Throttled to one write per
 * ACTIVITY_THROTTLE_MS per user (in memory, and again in SQL so multiple server
 * instances don't double-write). Never throws: activity tracking must not break
 * a request.
 */
export async function touchLastActive(userId: string, now: Date = new Date()): Promise<void> {
  const nowMs = now.getTime();
  if (!shouldTouch(recentlyTouched.get(userId), nowMs)) return;
  if (recentlyTouched.size >= MEMO_LIMIT) recentlyTouched.clear();
  recentlyTouched.set(userId, nowMs);
  try {
    const cutoff = new Date(nowMs - ACTIVITY_THROTTLE_MS);
    await db
      .update(schema.user)
      .set({
        lastActiveAt: now,
        // Being active isn't a profile edit; keep updatedAt (otherwise $onUpdate bumps it).
        updatedAt: sql`${schema.user.updatedAt}`,
      })
      .where(
        and(
          eq(schema.user.id, userId),
          or(isNull(schema.user.lastActiveAt), lt(schema.user.lastActiveAt, cutoff)),
        ),
      );
  } catch (error) {
    recentlyTouched.delete(userId);
    console.error("touchLastActive failed", error);
  }
}

/** Read a user's last-active time (null if never recorded). */
export async function getLastActiveAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastActiveAt: schema.user.lastActiveAt })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return row?.lastActiveAt ?? null;
}

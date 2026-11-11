import { timingSafeEqual } from "node:crypto";
import { db, eq, perksCard, perksSettings, user } from "@kch/db";
import { isDigestDay, sendDigest } from "@/lib/digest";
import { today } from "@/lib/perks";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Called once a day by the scheduler (see vercel.json). Emails each user who
 * has cards and has not switched the digest off, on digest days only.
 * Pass ?force=1 to send regardless of the day, for testing.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const now = today();
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && !isDigestDay(now)) return Response.json({ sent: 0, reason: "not a digest day" });

  const owners = await db
    .selectDistinct({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .innerJoin(perksCard, eq(perksCard.userId, user.id));
  const settings = new Map((await db.select().from(perksSettings)).map((s) => [s.userId, s]));

  let sent = 0;
  for (const owner of owners) {
    const s = settings.get(owner.id);
    if (s && (!s.digestEnabled || (!force && s.lastDigestOn === now))) continue;
    if (!(await sendDigest(owner, now))) continue;
    sent++;
    await db
      .insert(perksSettings)
      .values({ userId: owner.id, lastDigestOn: now })
      .onConflictDoUpdate({ target: perksSettings.userId, set: { lastDigestOn: now } });
  }
  return Response.json({ sent });
}

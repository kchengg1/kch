import "server-only";
import webpush from "web-push";
import { and, db, eq, perksPushSubscription, perksVapid } from "@kch/db";
import { appConfig } from "@/app.config";

/**
 * Web push. The signing keys (VAPID) are created the first time they are
 * needed and kept in the database, so there is nothing to set up in Vercel.
 */
async function vapidKeys() {
  const [row] = await db.select().from(perksVapid).where(eq(perksVapid.id, 1)).limit(1);
  if (row) return row;
  const keys = webpush.generateVAPIDKeys();
  await db
    .insert(perksVapid)
    .values({ id: 1, publicKey: keys.publicKey, privateKey: keys.privateKey })
    .onConflictDoNothing();
  // Re-read in case another request created the keys at the same moment.
  const [saved] = await db.select().from(perksVapid).where(eq(perksVapid.id, 1)).limit(1);
  return saved!;
}

export async function vapidPublicKey(): Promise<string> {
  return (await vapidKeys()).publicKey;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends to every device the user turned notifications on for. Returns how many got it. */
export async function sendPush(userId: string, message: PushMessage): Promise<number> {
  const subs = await db
    .select()
    .from(perksPushSubscription)
    .where(eq(perksPushSubscription.userId, userId));
  if (subs.length === 0) return 0;
  const keys = await vapidKeys();
  const contact = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? appConfig.supportEmail;
  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(message),
        {
          vapidDetails: {
            subject: `mailto:${contact}`,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
          },
          TTL: 60 * 60 * 24,
        },
      );
      delivered++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // The browser dropped this subscription (app removed, permission revoked): forget it.
      if (status === 404 || status === 410) {
        await db
          .delete(perksPushSubscription)
          .where(and(eq(perksPushSubscription.id, s.id), eq(perksPushSubscription.userId, userId)));
      } else {
        console.error("[push] send failed", status ?? err);
      }
    }
  }
  return delivered;
}

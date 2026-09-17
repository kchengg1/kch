import {
  and,
  db,
  desc,
  eq,
  inArray,
  purchase,
  subscription,
  type Purchase,
  type Subscription,
} from "@kch/db";
import { findPlanByPriceId, type Plan } from "./plans";

export const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export type Entitlements = {
  /** Most recent active subscription, if any. */
  subscription: Subscription | null;
  /** All completed one-time purchases. */
  purchases: Purchase[];
  /** Plan matched from subscription or purchase, if any. */
  plan: Plan | null;
  /** True when the user has paid for anything that is still valid. */
  isPaid: boolean;
};

/** Work out what a user has paid for. Cheap: two indexed queries. */
export async function getEntitlements(
  userId: string,
  plans: readonly Plan[],
): Promise<Entitlements> {
  const [subs, buys] = await Promise.all([
    db
      .select()
      .from(subscription)
      .where(
        and(eq(subscription.userId, userId), inArray(subscription.status, [...ACTIVE_STATUSES])),
      )
      .orderBy(desc(subscription.createdAt))
      .limit(1),
    db.select().from(purchase).where(eq(purchase.userId, userId)).orderBy(desc(purchase.createdAt)),
  ]);

  const sub = subs[0] ?? null;
  const plan =
    (sub && findPlanByPriceId(plans, sub.priceId)) ??
    buys.map((b) => findPlanByPriceId(plans, b.priceId)).find(Boolean) ??
    null;

  return { subscription: sub, purchases: buys, plan, isPaid: Boolean(sub) || buys.length > 0 };
}

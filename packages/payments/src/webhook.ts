import { db, eq, purchase, subscription, user as userTable } from "@kch/db";
import { stripe, type Stripe } from "./stripe";

/**
 * Verify the signature and apply the event to the database.
 * Idempotent: re-delivered events produce the same rows.
 *
 * Subscribe to these events in the Stripe dashboard (or `stripe listen`):
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  await applyStripeEvent(event);
  return event;
}

export async function applyStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "payment") await recordPurchase(session);
      if (session.mode === "subscription" && session.subscription) {
        const id =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe().subscriptions.retrieve(id);
        await syncSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    default:
      // Unhandled event types are fine; Stripe only needs a 2xx.
      break;
  }
}

async function resolveUserId(customerId: string, metadataUserId?: string | null) {
  if (metadataUserId) return metadataUserId;
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.stripeCustomerId, customerId))
    .limit(1);
  return row?.id ?? null;
}

function customerIdOf(c: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Upsert a subscription row from a Stripe subscription object. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = customerIdOf(sub.customer);
  if (!customerId) return;
  const userId = await resolveUserId(customerId, sub.metadata?.userId);
  if (!userId) {
    console.warn(`[stripe] subscription ${sub.id} has no matching user (customer ${customerId})`);
    return;
  }
  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  const values = {
    id: sub.id,
    userId,
    stripeCustomerId: customerId,
    priceId,
    status: sub.status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
  await db
    .insert(subscription)
    .values(values)
    .onConflictDoUpdate({ target: subscription.id, set: values });
}

async function recordPurchase(session: Stripe.Checkout.Session) {
  const customerId = customerIdOf(session.customer);
  const userId = await resolveUserId(
    customerId ?? "",
    session.metadata?.userId ?? session.client_reference_id,
  );
  if (!userId) {
    console.warn(`[stripe] checkout ${session.id} has no matching user`);
    return;
  }
  const items = await stripe().checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = items.data[0]?.price?.id ?? "";

  await db
    .insert(purchase)
    .values({
      id: session.id,
      userId,
      stripeCustomerId: customerId,
      priceId,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
    })
    .onConflictDoNothing();
}

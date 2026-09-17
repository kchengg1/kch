import { db, eq, user as userTable } from "@kch/db";
import type { Plan } from "./plans";
import { stripe } from "./stripe";

type MinimalUser = {
  id: string;
  email: string;
  name?: string | null;
  stripeCustomerId?: string | null;
};

/** Find the user's Stripe customer, creating one (and saving the id) if needed. */
export async function getOrCreateCustomer(user: MinimalUser): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  // Re-check the DB in case the session cookie is stale.
  const [row] = await db
    .select({ id: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1);
  if (row?.id) return row.id;

  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  });
  await db
    .update(userTable)
    .set({ stripeCustomerId: customer.id })
    .where(eq(userTable.id, user.id));
  return customer.id;
}

export type CheckoutInput = {
  user: MinimalUser;
  plan: Plan;
  successUrl: string;
  cancelUrl: string;
  /** Free-trial days for subscriptions. */
  trialDays?: number;
};

/** Create a Stripe Checkout session and return its URL. */
export async function createCheckoutSession(input: CheckoutInput): Promise<string> {
  const customer = await getOrCreateCustomer(input.user);
  const session = await stripe().checkout.sessions.create({
    customer,
    mode: input.plan.mode,
    line_items: [{ price: input.plan.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: input.user.id,
    metadata: { userId: input.user.id, planId: input.plan.id },
    ...(input.plan.mode === "subscription"
      ? {
          subscription_data: {
            metadata: { userId: input.user.id, planId: input.plan.id },
            ...(input.trialDays ? { trial_period_days: input.trialDays } : {}),
          },
        }
      : { invoice_creation: { enabled: true } }),
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Create a Customer Portal session (manage/cancel subscription, update card). */
export async function createPortalSession(user: MinimalUser, returnUrl: string): Promise<string> {
  const customer = await getOrCreateCustomer(user);
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: returnUrl });
  return session.url;
}

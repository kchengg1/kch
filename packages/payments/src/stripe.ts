import Stripe from "stripe";

let client: Stripe | undefined;

/** Lazily-created Stripe client (STRIPE_SECRET_KEY read at first use). */
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { typescript: true });
  }
  return client;
}

export type { Stripe };

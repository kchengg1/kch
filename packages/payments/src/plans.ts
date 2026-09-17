/**
 * A sellable thing. Apps declare their plans in app.config.ts and pass them to
 * the helpers here. `priceId` is a Stripe Price id (price_...).
 */
export type Plan = {
  /** Stable key used in URLs and code, e.g. "pro" or "lifetime". */
  id: string;
  name: string;
  description?: string;
  /** Display only; the real amount lives on the Stripe Price. */
  price: string;
  /** e.g. "/month". Omit for one-time purchases. */
  interval?: string;
  priceId: string;
  mode: "subscription" | "payment";
  features: string[];
  highlighted?: boolean;
};

export function findPlan(plans: readonly Plan[], id: string) {
  return plans.find((p) => p.id === id);
}

export function findPlanByPriceId(plans: readonly Plan[], priceId: string) {
  return plans.find((p) => p.priceId === priceId);
}

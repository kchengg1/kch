"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession, findPlan } from "@kch/payments";
import { appConfig, plans } from "@/app.config";
import { requireSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/url";

/** Build a Checkout URL for the signed-in user, or null if the plan is unknown. */
export async function checkoutUrlForPlan(planId: string): Promise<string | null> {
  const plan = findPlan(plans, planId);
  if (!plan || !plan.priceId) return null;
  const { user } = await requireSession();
  return createCheckoutSession({
    user,
    plan,
    trialDays: plan.mode === "subscription" ? appConfig.trialDays : undefined,
    successUrl: absoluteUrl("/dashboard/billing?status=success"),
    cancelUrl: absoluteUrl("/pricing?status=cancelled"),
  });
}

/** Form action used by CheckoutButton. */
export async function startCheckout(formData: FormData) {
  const planId = String(formData.get("planId") ?? "");
  const url = await checkoutUrlForPlan(planId);
  if (!url) redirect("/pricing");
  redirect(url);
}

/** Send the user to the Stripe Customer Portal. */
export async function openBillingPortal() {
  const { user } = await requireSession();
  const url = await createPortalSession(user, absoluteUrl("/dashboard/billing"));
  redirect(url);
}

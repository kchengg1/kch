import type { Plan } from "@kch/payments";

/**
 * THE file to edit when spinning up a new app. Everything on the marketing
 * pages, emails, metadata and pricing reads from here.
 */
export const appConfig = {
  name: "Template",
  tagline: "Ship your next side project this weekend",
  description:
    "A ready-to-sell starter with auth, payments, email and a dashboard so you can spend your time on the thing people pay for.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Shown in the footer and used for support links. */
  supportEmail: "hello@example.com",
  /** Used by Twitter/X cards. Leave blank to omit. */
  twitterHandle: "",
  /** Marketing copy for the landing page. */
  features: [
    {
      title: "Sign in that just works",
      description: "Email + password and Google, with password reset out of the box.",
    },
    {
      title: "Take money on day one",
      description: "Stripe Checkout for subscriptions and one-time purchases, synced by webhook.",
    },
    {
      title: "Know who's paying",
      description: "A dashboard that shows each user's plan and lets them manage billing.",
    },
  ],
  /** Free-trial length in days for subscription plans (0 = none). */
  trialDays: 0,
  /** Where to send people after login. */
  afterLoginPath: "/dashboard",
  /** Require email verification before login. Off for less friction. */
  requireEmailVerification: false,
} as const;

/**
 * Plans map to Stripe Prices. Create the products in the Stripe dashboard,
 * paste the price ids into .env, and they show up on /pricing.
 */
export const plans: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    description: "For people who use it every day.",
    price: "$9",
    interval: "/month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
    mode: "subscription",
    features: ["Everything in Free", "Unlimited projects", "Priority support"],
    highlighted: true,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    description: "Pay once, use forever.",
    price: "$99",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME ?? "",
    mode: "payment",
    features: ["Everything in Pro", "All future updates", "No recurring bill"],
  },
];

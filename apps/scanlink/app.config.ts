import type { Plan } from "@kch/payments";

/**
 * THE file to edit when spinning up a new app. Everything on the marketing
 * pages, emails, metadata and pricing reads from here.
 */
export const appConfig = {
  name: "Scanlink",
  tagline: "QR codes you can change after you print them",
  description:
    "Create dynamic QR codes for menus, flyers, packaging and events. Update where they point any time, and see exactly how many people scanned.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Shown in the footer and used for support links. */
  supportEmail: "hello@example.com",
  /** Used by Twitter/X cards. Leave blank to omit. */
  twitterHandle: "",
  /** Marketing copy for the landing page. */
  features: [
    {
      title: "Print once, edit forever",
      description:
        "Every code points to a short link you control. Change the destination without reprinting a thing.",
    },
    {
      title: "Know what gets scanned",
      description:
        "See total scans, daily trends and where scans come from, per code. No analytics setup required.",
    },
    {
      title: "Ready for print",
      description:
        "Download crisp SVG or high-resolution PNG files that look sharp on a business card or a billboard.",
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
    description: "For businesses with more than a handful of codes.",
    price: "$9",
    interval: "/month",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
    mode: "subscription",
    features: [
      "Unlimited QR codes",
      "Scan analytics per code",
      "Daily trends and referrers",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    description: "Pay once, use forever.",
    price: "$79",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME ?? "",
    mode: "payment",
    features: ["Everything in Pro", "All future updates", "No recurring bill"],
  },
];

/**
 * App-wide copy and settings. Perks is a personal tool: there are no plans or
 * pricing, and sign-up can be limited to your own address with ALLOWED_EMAILS.
 */
export const appConfig = {
  name: "Perks",
  tagline: "Use every credit your cards give you",
  description:
    "Track the statement credits, offers and sign-up bonuses across your credit cards, and see what is about to expire before it does.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Shown in the footer and used for support links. */
  supportEmail: "hello@example.com",
  /** Used by Twitter/X cards. Leave blank to omit. */
  twitterHandle: "",
  /** The three cards on the landing page. */
  features: [
    {
      title: "Credits before they expire",
      description:
        "Monthly, quarterly, twice-yearly and cardmember-year credits in one list, sorted by deadline.",
    },
    {
      title: "Offers you would otherwise forget",
      description:
        "Paste your Amex Offers or Chase Offers page and get reminded before each one lapses.",
    },
    {
      title: "Bonuses you can actually get",
      description:
        "Current sign-up offers checked against 5/24 and the cards you have already had.",
    },
  ],
  /** Where to send people after login. */
  afterLoginPath: "/dashboard",
  /** Require email verification before login. Off for less friction. */
  requireEmailVerification: false,
} as const;

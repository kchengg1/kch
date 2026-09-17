# Launching a new app

Goal: idea → live, taking payments, in an afternoon. Do the steps in order.

## 1. Scaffold

```bash
pnpm new-app <name> --title "<Display Name>"
pnpm install
```

## 2. Database

Create a free Postgres database (Neon, Supabase, or Railway). Use the **pooled**
connection string if the provider offers one.

```bash
# apps/<name>/.env
DATABASE_URL=postgres://...
```

```bash
DATABASE_URL=... pnpm db:push       # dev: push schema
# or, for production-style migrations:
DATABASE_URL=... pnpm db:migrate
```

One database per app. The schema is shared, the data is not.

## 3. Run it

```bash
pnpm --filter @kch/<name> dev
```

Sign up at `/signup`. With no email provider configured, verification and reset
emails print to the terminal.

## 4. Copy and config

Edit `apps/<name>/app.config.ts`:

- `name`, `tagline`, `description`: used for the landing page, `<title>`, Open Graph.
- `features`: the three cards on the landing page.
- `plans`: what you sell. Each needs a Stripe price id (next step).
- `supportEmail`, `trialDays`, `requireEmailVerification`.

Colours: override tokens in `apps/<name>/app/globals.css` under `@theme`.

## 5. Stripe

1. Dashboard → Products → create a product per plan. Copy each **price id**.
2. `.env`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PRICE_*` matching `app.config.ts`.
3. Local webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Paste the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. Production webhook: Developers → Webhooks → endpoint
   `https://<domain>/api/webhooks/stripe` with events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
5. Enable the Customer Portal (Settings → Billing → Customer portal) so
   "Manage subscription" works.

Test with card `4242 4242 4242 4242`. After paying, `/dashboard` shows the plan.

## 6. Build the feature

`apps/<name>/app/dashboard/page.tsx` is the blank canvas. Gate paid features:

```ts
const ent = await getEntitlements(user.id, plans);
if (!ent.isPaid) redirect("/pricing");
```

Add tables to `packages/db/src/schema.ts` and run `pnpm db:generate`.

## 7. Optional services

| Service      | Env vars                                   | Effect                         |
| ------------ | ------------------------------------------ | ------------------------------ |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google" button  |
| Resend       | `RESEND_API_KEY`, `EMAIL_FROM`             | Real emails instead of console |
| PostHog      | `NEXT_PUBLIC_POSTHOG_KEY`                  | Pageviews + `track()` events   |

Google OAuth redirect URI: `https://<domain>/api/auth/callback/google`.

## 8. Deploy (Vercel)

1. Import the repo. Root directory: `apps/<name>`. Framework: Next.js.
2. Build command: `cd ../.. && pnpm turbo run build --filter=@kch/<name>`.
   Install command: `cd ../.. && pnpm install`.
3. Add every env var from `.env` (production values). Set `NEXT_PUBLIC_APP_URL`
   and `BETTER_AUTH_URL` to the real domain.
4. Run `pnpm db:migrate` against the production database.
5. Point the Stripe production webhook at the deployed URL.

## 9. Before you announce

- [ ] Replace `/legal/privacy` and `/legal/terms` placeholders.
- [ ] Add `public/opengraph-image.png` (1200×630) for link previews.
- [ ] Test the full flow in production: signup → pay → manage billing → sign out.
- [ ] Turn on `requireEmailVerification` if spam signups become a problem.

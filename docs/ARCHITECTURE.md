# Architecture notes

## Principles

1. **Copy, don't abstract, at the app level.** Each app owns its pages so it can
   diverge freely. Only cross-cutting concerns live in packages.
2. **Packages ship TypeScript source.** No build step; Next transpiles them via
   `transpilePackages`. Change a package, every app picks it up on next dev reload.
3. **Everything lazy, everything optional.** Clients for the DB, auth, Stripe and
   email are created on first use, so `next build` works with no secrets and CI
   never needs real credentials. Optional services silently no-op when unset.
4. **Stripe is the source of truth for billing.** The `subscription` and
   `purchase` tables are a cache written only by the webhook. Never write them
   from UI code.

## Request flow

```
browser ── /login ──▶ AuthForm (client) ──▶ /api/auth/* ──▶ better-auth ──▶ Postgres
browser ── /pricing ─▶ CheckoutButton ──▶ startCheckout (server action)
                                        ──▶ Stripe Checkout ──▶ Stripe webhook
                                                                ──▶ /api/webhooks/stripe
                                                                ──▶ syncSubscription()
browser ── /dashboard ▶ proxy.ts (cookie check) ▶ layout requireSession() ▶ page
```

## Auth

- `packages/auth` wraps better-auth with the Drizzle adapter and `nextCookies`.
- Session cookie is cached for 5 minutes (`cookieCache`) so most requests skip the DB.
- `proxy.ts` only inspects the cookie (fast, no DB). Real verification happens in
  `app/dashboard/layout.tsx` via `requireSession()`.
- `user.stripeCustomerId` is an `additionalField` (not client-writable).

## Payments

- `Plan` objects in `app.config.ts` map ids → Stripe price ids.
- `createCheckoutSession` creates/looks up the Stripe customer and stores its id on
  the user; `metadata.userId` is set on the session and subscription so the webhook
  can always map back to a user.
- `getEntitlements(userId, plans)` returns the active subscription, purchases, the
  matching plan and an `isPaid` boolean. Use it to gate features.
- Stripe API (basil and later) puts `current_period_end` on the subscription
  **item**, which is what `syncSubscription` reads.

## Database

- Drizzle + `postgres` driver with `prepare: false` for pooler compatibility.
- The shared `db` export is a Proxy so importing it never connects.
- Migrations live in `packages/db/drizzle`. Run `pnpm db:generate` after schema edits.

## Adding a shared package

```bash
mkdir -p packages/foo/src
# copy package.json, tsconfig.json, eslint.config.mjs from packages/email
# add "@kch/foo": "workspace:*" to the app and to next.config.ts transpilePackages
```

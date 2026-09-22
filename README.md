# kch — side-app foundation

A monorepo for shipping many small paid web apps fast. Every app is a copy of
`apps/template` that already has sign-in, Stripe billing, transactional email,
analytics, a landing page and a dashboard. You add the feature people pay for.

```
pnpm new-app invoice-buddy --title "Invoice Buddy"
```

## What's inside

| Path                  | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `apps/template`       | The Next.js app every new app is cloned from                           |
| `apps/<name>`         | Your apps (one folder each, all deploy independently)                  |
| `apps/trader`         | Autonomous Claude trading agent for Alpaca (CLI, not a web app)        |
| `packages/ui`         | Shared components + design tokens (Tailwind v4)                        |
| `packages/db`         | Drizzle schema + Postgres client. Auth and billing tables              |
| `packages/auth`       | better-auth config: email/password, Google, password reset             |
| `packages/payments`   | Stripe Checkout, Customer Portal, webhook sync, entitlements           |
| `packages/email`      | Resend wrapper + HTML templates (prints to console without an API key) |
| `packages/analytics`  | PostHog provider + `track()` (no-op without a key)                     |
| `packages/config`     | Shared tsconfig presets                                                |
| `scripts/new-app.mjs` | Scaffolds a new app from the template                                  |
| `docs/`               | Launch checklist, architecture notes, testing guide                    |

Stack: pnpm workspaces · Turborepo · Next.js 16 (App Router) · React 19 ·
TypeScript · Tailwind v4 · Drizzle + Postgres · better-auth · Stripe · Resend · PostHog.

## Quick start

```bash
pnpm install
pnpm new-app my-app --title "My App"       # creates apps/my-app + .env
# edit apps/my-app/.env → DATABASE_URL (Neon/Supabase/local Postgres)
DATABASE_URL=... pnpm db:push               # create tables
pnpm --filter @kch/my-app dev               # http://localhost:3000
```

Sign up, visit `/dashboard`, and you have a working app. Stripe, Google login,
email and analytics all switch on when their env vars are set. See
[docs/NEW_APP.md](docs/NEW_APP.md) for the full launch checklist.

## Commands

| Command                        | What it does                                         |
| ------------------------------ | ---------------------------------------------------- |
| `pnpm dev`                     | Dev servers for every app (use `--filter` for one)   |
| `pnpm check`                   | Lint + typecheck + tests for the whole repo          |
| `pnpm --filter @kch/<app> e2e` | Browser + database checks ([guide](docs/TESTING.md)) |
| `pnpm build`                   | Production build of everything                       |
| `pnpm format`                  | Prettier                                             |
| `pnpm db:generate`             | Write a SQL migration after editing the schema       |
| `pnpm db:migrate`              | Apply migrations (production)                        |
| `pnpm db:push`                 | Push schema directly (dev)                           |
| `pnpm db:studio`               | Browse the database                                  |
| `pnpm new-app <name>`          | Scaffold a new app                                   |

## Where to put things

- **A feature only one app needs** → inside that app (`apps/<name>/app/...`).
- **Something two apps need** → a package under `packages/`. Import it as `@kch/<pkg>`.
- **A new table** → `packages/db/src/schema/<app>.ts` (export it from `index.ts`), then `pnpm db:generate`. All apps
  share one schema; give each app its own database so their data stays separate.

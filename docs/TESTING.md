# Testing

Three layers, cheapest first. The first two run in CI on every push; the third is
opt-in because it needs a database and a browser.

| Layer        | Command      | What it covers                                 |
| ------------ | ------------ | ---------------------------------------------- |
| Lint + types | `pnpm check` | Lint, TypeScript, and unit tests, whole repo   |
| Unit         | `pnpm test`  | Pure functions (URL parsing, plan lookup, ...) |
| End to end   | `pnpm e2e`   | The real app, real browser, real Postgres      |

## Unit tests

Vitest, colocated next to the code (`lib/validate.test.ts`). Keep them for logic
with no I/O; anything touching the database belongs in the end-to-end layer.

## End-to-end tests

These drive a real browser against a running build and a real database, so they
catch what unit tests cannot: server actions, redirects, session cookies,
ownership checks, and SQL that only fails against live Postgres.

```bash
# 1. A throwaway database (prints the URL to use)
export DATABASE_URL=$(./scripts/dev-db.sh start scanlink)

# 2. Schema
pnpm db:migrate

# 3. Build and start the app on the port the tests expect
cd apps/scanlink
cp .env.example .env            # then set DATABASE_URL and BETTER_AUTH_SECRET
pnpm build
PORT=3100 pnpm start &

# 4. Run the checks
pnpm e2e
```

Every check prints `PASS` or `FAIL` and the process exits non-zero if any fail.

Environment variables the suite reads:

| Variable        | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| `DATABASE_URL`  | Required. The scratch database to use                      |
| `E2E_BASE_URL`  | Where the app is running (default `http://localhost:3100`) |
| `CHROMIUM_PATH` | Browser binary, when not using Playwright's own download   |

**The suite truncates every table in `DATABASE_URL` before it runs.** Point it at
a scratch database, never at anything you care about.

### Writing them for a new app

Copy `apps/scanlink/e2e/run.mjs` and rewrite the checks. The parts worth keeping:

- Truncate up front so runs are reproducible and order-independent.
- Sign up through the real form rather than inserting a user, so auth is covered.
- Assert against the database as well as the page, so you catch a green screen
  sitting on top of a write that never happened.
- Exclude the Next.js route announcer when matching alerts. It carries
  `role="alert"` with no text and will match a bare `[role="alert"]` selector.
- Cover the money paths: the free limit, and what a paid account unlocks.

# Perks

A personal credit card benefit tracker. It keeps every statement credit, saved
offer and sign-up bonus in one place and shows what is about to expire.

| Page     | What it does                                                                       |
| -------- | ---------------------------------------------------------------------------------- |
| Overview | Unused credits sorted by deadline, expiring offers, upcoming annual fees           |
| Cards    | Your cards, a usage grid per credit, and a one-paste import from a spreadsheet     |
| Offers   | Paste an Amex Offers or Chase Offers page; offers are parsed and tracked to expiry |
| Bonuses  | Current sign-up offers checked against 5/24 and the cards you have had             |
| Settings | Email digest on or off                                                             |

## Run it

```bash
export DATABASE_URL=$(./scripts/dev-db.sh start perks)   # or a Neon/Supabase URL
pnpm db:migrate
cp apps/perks/.env.example apps/perks/.env                # set DATABASE_URL, BETTER_AUTH_SECRET
pnpm --filter @kch/perks dev
```

Sign up, then go to Cards → Import from spreadsheet and paste the Credit Cards
tab of your sheet. Deploying is the same as any app here: see
[docs/NEW_APP.md](../../docs/NEW_APP.md) step 8, skipping the Stripe steps.

Once it is on the internet, set `ALLOWED_EMAILS` to your own address so nobody
else can create an account.

## Where things live

| File                       | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `lib/catalog.ts`           | Built-in cards and their credits. Edit here when an issuer changes   |
| `lib/periods.ts`           | Monthly, quarterly, twice-yearly, calendar and cardmember-year maths |
| `lib/summary.ts`           | What is unused, what is due, totals per card                         |
| `lib/offer-parse.ts`       | Heuristic parser for pasted offers pages                             |
| `lib/sheet-import.ts`      | Reads the pasted spreadsheet and matches cards to the catalog        |
| `lib/eligibility.ts`       | 5/24, Amex once-per-lifetime and other bonus rules                   |
| `data/signup-bonuses.json` | The sign-up offers shown on the Bonuses page                         |
| `lib/digest.ts`            | The reminder email                                                   |

Adding a card from the catalog copies its credits into the database, so later
catalog edits do not change cards you already have. Edit those on the card page.

## Reminders

- **Email digest.** `vercel.json` calls `/api/cron/digest` daily; it sends on
  Mondays and on the 25th, and only when something is due. Needs `CRON_SECRET`,
  `RESEND_API_KEY` and `EMAIL_FROM`. Without Resend the email prints to the log.
- **Time zone.** `PERKS_TIMEZONE` decides what "today" is (default New York).

## Limits worth knowing

- Amex and Chase offer no API, so offers arrive by copy and paste. The parser is
  a heuristic: check the preview before saving.
- Catalog benefits were reviewed on the date in `CATALOG_REVIEWED`. Issuers
  change them often, and the issuer's own benefits page is the authority.
- Bonus eligibility is an estimate from published rules, not a decision.

## Tests

```bash
pnpm --filter @kch/perks test    # unit tests for all of lib/
pnpm --filter @kch/perks e2e     # browser + database, see docs/TESTING.md
```

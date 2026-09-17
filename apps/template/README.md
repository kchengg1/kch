# App template

Copy of this folder = new app. Run `pnpm new-app <name>` from the repo root, then edit
`app.config.ts` and `.env`. See `/docs/NEW_APP.md` for the full launch checklist.

Routes:

| Path                    | What                                            |
| ----------------------- | ----------------------------------------------- |
| `/`                     | Landing page (copy from `app.config.ts`)        |
| `/pricing`              | Plans → Stripe Checkout                         |
| `/login`, `/signup`     | Email/password + Google (if configured)         |
| `/forgot-password`      | Password reset flow                             |
| `/dashboard`            | Protected. Put the product here                 |
| `/dashboard/billing`    | Plan status, Stripe Customer Portal             |
| `/dashboard/settings`   | Account details                                 |
| `/api/auth/*`           | better-auth handler                             |
| `/api/webhooks/stripe`  | Stripe webhook → `subscription`/`purchase` rows |
| `/legal/privacy`, terms | Placeholders. Replace before launch             |

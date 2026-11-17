# kch Monorepo — Agent Guide

## Workspace Layout

- `apps/perks` (`@kch/perks`) — Credit card benefits, offers, points, referrals, and group tracker (Next.js App Router + Drizzle/Postgres). Also serves the mobile JSON API (`/api/mobile/*`).
- `apps/perks-ios` (`@kch/perks-ios`) — Native iOS client for Perks (Expo / React Native, Bundle ID `com.kchengg1.perks`).
- `packages/perks-types` (`@kch/perks-types`) — Canonical TypeScript wire contract (`MobileBootstrap`, `MobileActionPayload`, `MobileActionResponse`, etc.) shared between `@kch/perks` and `@kch/perks-ios`.
- `apps/home` (`@kch/home`) — Personal landing hub.
- `packages/db` (`@kch/db`) — Shared Drizzle ORM schema & Postgres client.
- `packages/auth` (`@kch/auth`) — Shared Better Auth setup (cookie sessions + Bearer tokens for mobile).
- `packages/ui`, `packages/tsconfig`, `packages/eslint-config` — Shared UI and tooling configs.

## Mandatory Rule: Perks Web ↔ iOS Feature Parity

Whenever you add, change, or remove any **user-facing feature, data field, or mutation** in `apps/perks`, you **MUST** ship the matching iOS support in the **same PR** unless the user explicitly scopes the task to web-only:

1. **Shared Wire Contract (`packages/perks-types/src/index.ts`)**:
   - Update `MobileBootstrap`, `MobileActionPayload`, `MobileActionResponse`, or supporting types first.
   - Keep `@kch/perks-types` pure TypeScript `export type` declarations only (zero runtime imports) so Next.js and Metro (`expo export`) stay decoupled at bundle time while `pnpm check` enforces compile-time parity across both apps.
2. **Mobile Backend (`apps/perks`)**:
   - Expose new read data in `apps/perks/lib/mobile-api.ts` (`buildMobileBootstrap`) and `apps/perks/lib/mobile-server.ts` (`loadMobileBootstrap`).
   - Parse new mutations in `parseMobileAction` (`apps/perks/lib/mobile-api.ts` — enforced at compile time by `AssertMobileActionParity`) and handle them in `apps/perks/app/api/mobile/action/route.ts`.
   - Add/update tests in `apps/perks/lib/mobile-api.test.ts`.
   - If you update `apps/perks/lib/earn.ts` (category multipliers / merchant rules), mirror the same update in `apps/perks-ios/src/lib/earn.ts`.
3. **Native iOS UI (`apps/perks-ios`)**:
   - Build or update the corresponding React Native screen/modal in `apps/perks-ios/src/screens/` (`OverviewScreen`, `CardsScreen`, `OffersScreen`, `PointsScreen`, `PeopleScreen`, `BonusesScreen`, `CardDetailModal`, `CatchUpModal`, `YearEndModal`, `SettingsModal`).
   - Keep touch targets comfortable (`>= 38–44pt`), avoid nesting `FlatList` inside `ScrollView`, and use `NUM_STYLE` (`tabular-nums`) on dollar/point figures.
4. **Deployment Behavior**:
   - JS/UI changes in `apps/perks-ios/**` and `packages/perks-types/**` automatically publish an Expo OTA update to the `production` channel on merge via `.github/workflows/ios-ota-update.yml` (when `EXPO_TOKEN` is configured in GitHub Secrets), or manually via `pnpm ios:ota`.
   - Only native changes (`app.json` plugins/permissions, Expo SDK bumps, or new native modules) require a new TestFlight binary via `pnpm ios:testflight` (and bumping `ios.buildNumber` in `apps/perks-ios/app.json`).

## Required Verification Before Opening / Updating a PR

Always run from the repo root:

```bash
pnpm format
pnpm format:check
pnpm check
NEXT_PUBLIC_APP_URL=https://kch-six.vercel.app pnpm build
```

- Never commit directly to `master`/`main`; always use a feature branch and open a PR.
- Do not touch unrelated active branches created by other agents/sessions.

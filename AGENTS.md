# kch Monorepo — Agent Guide

See [CLAUDE.md](./CLAUDE.md) for the canonical monorepo layout, verification commands, and mandatory rules — all instructions in `CLAUDE.md` apply equally to every AI coding agent working in this repository.

## Quick Summary of Mandatory Perks Web ↔ iOS Parity Rule

Any PR that adds, modifies, or removes user-facing features in `apps/perks` **must** update the iOS app in the same PR:

1. Update the shared pure-type contract in `packages/perks-types/src/index.ts`.
2. Update `apps/perks/lib/mobile-api.ts`, `apps/perks/lib/mobile-server.ts`, `apps/perks/app/api/mobile/action/route.ts`, and `apps/perks/lib/mobile-api.test.ts` (and mirror any `apps/perks/lib/earn.ts` changes to `apps/perks-ios/src/lib/earn.ts`).
3. Update the corresponding screens/modals in `apps/perks-ios/src/screens/`.
4. Verify with `pnpm format:check && pnpm check && NEXT_PUBLIC_APP_URL=https://kch-six.vercel.app pnpm build`.

# Perks for iOS (`@kch/perks-ios`)

Native iOS companion app for `apps/perks`, built with Expo (React Native + TypeScript). Each account signs in with its own credentials stored in the iOS Keychain (`expo-secure-store`) and talks to the Perks server's `/api/mobile/bootstrap` and `/api/mobile/action` JSON endpoints.

## Running locally (Expo Go or iOS Simulator)

1. Copy `.env.example` to `.env` inside `apps/perks-ios` and set `EXPO_PUBLIC_API_URL` to your deployed Perks URL (or `http://<your-lan-ip>:3100` when testing against a local `apps/perks` dev server on a phone). You can also change the server URL directly on the Sign-in screen under **Server connection**.
2. Start Expo from the repository root:
   ```bash
   pnpm --filter @kch/perks-ios dev
   ```
3. Scan the QR code with the **Expo Go** iOS app, or press `i` on macOS to open in the iOS Simulator.

## Shipping to TestFlight (EAS Build + GitHub Actions)

`eas.json` pins Node `22.14.0` and pnpm `10.33.0` for the monorepo, sets `ITSAppUsesNonExemptEncryption: false` in `app.json` (skipping Apple's export-compliance prompt), and configures automatic build-number increments + App Store Connect submission.

### 1. One-time Apple & Expo setup (run once from your terminal)

Apple requires interactive 2FA the very first time you generate an Apple Distribution certificate and App Store Connect API key. From the repo root, run:

```bash
# Links apps/perks-ios to your Expo account (writes extra.eas.projectId into app.json),
# generates/stores your Apple Distribution cert + App Store Connect API key in EAS,
# builds the iOS IPA in Expo's cloud, and uploads it to TestFlight:
pnpm ios:testflight
```

Commit and push the `extra.eas.projectId` line added to `apps/perks-ios/app.json`.

### 2. Triggering TestFlight builds from GitHub Actions

Once step 1 is done, `.github/workflows/ios-testflight.yml` runs completely unattended:

1. Create an Expo Personal Access Token at `https://expo.dev/settings/access-tokens`.
2. In GitHub **Settings → Secrets and variables → Actions**:
   - Add repository **Secret** `EXPO_TOKEN` with that token.
   - Add repository **Variable** `EXPO_PUBLIC_API_URL` set to your production Vercel URL (e.g. `https://your-perks-domain.vercel.app`).
3. Trigger a build anytime via:
   - **GitHub Actions → iOS TestFlight → Run workflow** (choose `production` for TestFlight or `preview` for ad-hoc internal install), or
   - Pushing a tag matching `ios-v*` (e.g. `git tag ios-v0.1.0 && git push origin ios-v0.1.0`).

## Checks

From the repo root:

- `pnpm --filter @kch/perks-ios test` — unit tests (`src/lib/format.test.ts`)
- `pnpm --filter @kch/perks-ios typecheck` — TypeScript strict check
- `pnpm --filter @kch/perks-ios lint` — ESLint
- `pnpm --filter @kch/perks-ios build` — Metro iOS bundle export (`expo export --platform ios`)

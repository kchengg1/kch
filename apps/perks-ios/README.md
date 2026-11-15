# Perks for iOS (`@kch/perks-ios`)

Native iOS companion app for `apps/perks`, built with Expo (React Native + TypeScript). Each account signs in with its own credentials stored in the iOS Keychain (`expo-secure-store`) and talks to the Perks server's `/api/mobile/bootstrap` and `/api/mobile/action` JSON endpoints.

## Running locally (Expo Go or iOS Simulator)

1. Copy `.env.example` to `.env` inside `apps/perks-ios` and set `EXPO_PUBLIC_API_URL` to your deployed Perks URL (or `http://<your-lan-ip>:3100` when testing against a local `apps/perks` dev server on a phone). You can also change the server URL directly on the Sign-in screen under **Server connection**.
2. Start Expo from the repository root:
   ```bash
   pnpm --filter @kch/perks-ios dev
   ```
3. Scan the QR code with the **Expo Go** iOS app, or press `i` on macOS to open in the iOS Simulator.

## Building for TestFlight / internal distribution (EAS)

`eas.json` defines `development`, `preview` (ad-hoc internal install), and `production` (App Store Connect / TestFlight) profiles:

```bash
cd apps/perks-ios
npx eas-cli build --platform ios --profile preview
# or for TestFlight:
npx eas-cli build --platform ios --profile production --auto-submit
```

Set `EXPO_PUBLIC_API_URL` in EAS Environment Variables so cloud builds connect to your production Vercel deployment out of the box.

## Checks

From the repo root:

- `pnpm --filter @kch/perks-ios test` — unit tests (`src/lib/format.test.ts`)
- `pnpm --filter @kch/perks-ios typecheck` — TypeScript strict check
- `pnpm --filter @kch/perks-ios lint` — ESLint
- `pnpm --filter @kch/perks-ios build` — Metro iOS bundle export (`expo export --platform ios`)

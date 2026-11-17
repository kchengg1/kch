# Perks for iOS (`@kch/perks-ios`)

Native iOS companion app for `apps/perks`, built with Expo (React Native + TypeScript). Each account signs in with its own credentials stored in the iOS Keychain (`expo-secure-store`) and talks to the Perks server's `/api/mobile/bootstrap` and `/api/mobile/action` JSON endpoints.

## Shipping to TestFlight (No `pnpm` or Xcode required)

You do **not** need `pnpm` or Xcode installed locally. Everything installs on GitHub Actions and Expo's cloud macOS build servers (`apps/perks-ios/eas.json` pins Node `22.14.0` and `pnpm@10.33.0` remotely).

### Option A: Browser + GitHub Actions (zero local CLI)

1. **App Store Connect** (`https://appstoreconnect.apple.com`):
   - Create an App record under **My Apps → + → New App** (iOS, Bundle ID `com.kchengg1.perks`) and copy its numeric **Apple ID** under **General → App Information** (e.g. `6501234567`).
   - Under **Users and Access → Integrations → App Store Connect API**, generate a key (Admin/App Manager) and note the **Issuer ID**, **Key ID**, and download the `.p8` file.
   - Note your 10-character **Apple Team ID** at `https://developer.apple.com/account`.
2. **Expo** (`https://expo.dev`):
   - Create an access token at `https://expo.dev/settings/access-tokens`.
   - Under your project's **Credentials → iOS**, upload or generate your **iOS Distribution Certificate** once in the web UI (EAS requires an existing Distribution Certificate before running non-interactive CI builds).
3. **GitHub Secrets & Variables** (`Settings → Secrets and variables → Actions`):
   - **Secrets**:
     - `EXPO_TOKEN` — your Expo access token
     - `EXPO_APPLE_TEAM_ID` — your 10-character Apple Team ID
     - `EXPO_ASC_KEY_ID` — App Store Connect API Key ID
     - `EXPO_ASC_ISSUER_ID` — App Store Connect Issuer ID
     - `EXPO_ASC_API_KEY` — full text contents of your `AuthKey_XXXX.p8` file
   - **Variables**:
     - `EXPO_PUBLIC_API_URL` — `https://kch-six.vercel.app` (already configured by default in `eas.json`)
     - `ASC_APP_ID` — your numeric App Store Connect Apple ID (enables automatic TestFlight submission)
4. **Run the build**:
   - Open **GitHub → Actions → iOS TestFlight → Run workflow** and click **Run workflow**.

---

### Option B: One `npx` command (or GitHub Codespaces) — easiest first-time Apple setup

If you have Node.js (`npx`) — or open a browser terminal via **GitHub → Code → Codespaces → Create codespace** — run `eas-cli` directly inside `apps/perks-ios` with **no `pnpm` required**. It logs into Apple interactively once to generate your Distribution Certificate, Provisioning Profile, and App Store Connect setup automatically:

```bash
cd apps/perks-ios
npx --yes eas-cli@latest build --platform ios --profile production --auto-submit
```

## Running locally in Expo Go

```bash
pnpm --filter @kch/perks-ios dev
```

## Checks

From the repo root:

- `pnpm --filter @kch/perks-ios test` — unit tests (`src/lib/format.test.ts`)
- `pnpm --filter @kch/perks-ios typecheck` — TypeScript strict check
- `pnpm --filter @kch/perks-ios lint` — ESLint
- `pnpm --filter @kch/perks-ios build` — Metro iOS bundle export (`expo export --platform ios`)

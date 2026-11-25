import { normalizeServerUrl } from "./format";

export type BiometricCredentials = {
  email: string;
  password: string;
  serverUrl: string;
};

export type BiometricCredentialsMeta = {
  email: string;
  serverUrl: string;
};

export type BiometricReadResult<T> =
  | { status: "ok"; value: T }
  | { status: "empty" }
  | { status: "canceled" }
  | { status: "unavailable"; message: string };

export type BiometricSignInOutcome =
  | { status: "ok" }
  | { status: "canceled" }
  | { status: "empty"; email?: string }
  | { status: "invalid_credentials"; email: string; message: string }
  | { status: "error"; message: string };

export function parseBiometricCredentials(raw: string | null): BiometricCredentials | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricCredentials> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    const serverUrl =
      typeof parsed.serverUrl === "string" ? normalizeServerUrl(parsed.serverUrl) : null;
    if (!email || !password || !serverUrl) return null;
    return { email, password, serverUrl };
  } catch {
    return null;
  }
}

export function parseBiometricMeta(raw: string | null): BiometricCredentialsMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricCredentialsMeta> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const email = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const serverUrl =
      typeof parsed.serverUrl === "string" ? normalizeServerUrl(parsed.serverUrl) : null;
    if (!email || !serverUrl) return null;
    return { email, serverUrl };
  } catch {
    return null;
  }
}

export function serializeBiometricCredentials(creds: BiometricCredentials): string | null {
  const email = creds.email.trim();
  const serverUrl = normalizeServerUrl(creds.serverUrl);
  if (!email || !creds.password || !serverUrl) return null;
  return JSON.stringify({ email, password: creds.password, serverUrl });
}

export function serializeBiometricMeta(meta: BiometricCredentialsMeta): string | null {
  const email = meta.email.trim();
  const serverUrl = normalizeServerUrl(meta.serverUrl);
  if (!email || !serverUrl) return null;
  return JSON.stringify({ email, serverUrl });
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && typeof err.message === "string") {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return "";
}

/**
 * Detect user-initiated dismissal of the system Face ID / biometric prompt.
 * Matches iOS Keychain ("User canceled the operation."), Android ("User canceled the authentication"),
 * and LocalAuthentication ("user_cancel").
 */
export function isBiometricCancelError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes("user canceled") ||
    msg.includes("user cancelled") ||
    msg.includes("user_cancel") ||
    msg.includes("canceled by user") ||
    msg.includes("cancelled by user")
  );
}

/**
 * Convert native iOS Keychain / expo-secure-store exceptions into concise user-facing guidance.
 */
export function formatBiometricError(err: unknown, label = "Face ID"): string {
  const msg = getErrorMessage(err).toLowerCase();
  if (msg.includes("nsfaceidusagedescription")) {
    return `${label} permission is not configured in this build.`;
  }
  if (msg.includes("interaction is not allowed")) {
    return `${label} is unavailable while the app is in the background. Try again.`;
  }
  if (msg.includes("authentication failed") || msg.includes("not enrolled")) {
    return `${label} could not verify your identity. Check iPhone Settings → Perks → ${label}.`;
  }
  if (msg.includes("no keychain is available") || msg.includes("not available")) {
    return `${label} isn't available on this device right now.`;
  }
  return `Could not verify with ${label}. Try again or sign in with your password.`;
}

/**
 * Determine whether transitioning from `prevState` to `nextState` should lock the app.
 * Only locks when the app enters the true `"background"` state — never on `"inactive"`,
 * because iOS transitions `"active" -> "inactive" -> "active"` whenever the native Face ID
 * sheet is presented, which would otherwise trigger an infinite unlock loop.
 */
export function shouldLockOnAppStateChange(
  nextState: string,
  opts: { signedIn: boolean; lockEnabled: boolean },
): boolean {
  return nextState === "background" && opts.signedIn && opts.lockEnabled;
}

export function isBiometricMetaForEmail(
  meta: BiometricCredentialsMeta | null,
  email: string,
): boolean {
  if (!meta) return false;
  return meta.email.trim().toLowerCase() === email.trim().toLowerCase();
}

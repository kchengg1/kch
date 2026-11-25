import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  formatBiometricError,
  isBiometricCancelError,
  parseBiometricCredentials,
  parseBiometricMeta,
  serializeBiometricCredentials,
  serializeBiometricMeta,
  type BiometricCredentials,
  type BiometricCredentialsMeta,
  type BiometricReadResult,
} from "./biometrics-helpers";

export type {
  BiometricCredentials,
  BiometricCredentialsMeta,
  BiometricReadResult,
  BiometricSignInOutcome,
} from "./biometrics-helpers";
export { isBiometricMetaForEmail, shouldLockOnAppStateChange } from "./biometrics-helpers";

const BIOMETRIC_CREDS_KEY = "perks_biometric_credentials";
const BIOMETRIC_META_KEY = "perks_biometric_meta";
const BIOMETRIC_LOCK_ENABLED_KEY = "perks_biometric_lock_enabled";
const BIOMETRIC_LOCK_SENTINEL_KEY = "perks_biometric_lock_sentinel";

export function getBiometricLabel(): string {
  return Platform.OS === "ios" ? "Face ID" : "Biometrics";
}

export function isBiometricSupported(): boolean {
  if (Platform.OS === "web") return false;
  try {
    return SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

async function deleteQuietly(key: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore missing item or platform storage errors
  }
}

/**
 * Read non-sensitive metadata (`{ email, serverUrl }`) so the UI knows whether
 * Face ID sign-in is configured without triggering a biometric prompt.
 */
export async function getBiometricMeta(): Promise<BiometricCredentialsMeta | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_META_KEY);
    return parseBiometricMeta(raw);
  } catch {
    return null;
  }
}

/**
 * Store sign-in credentials protected by iOS Keychain biometric access control
 * (`.biometryCurrentSet`). Deletes any prior entry first so iOS executes `SecItemAdd`
 * rather than `SecItemUpdate` (which would otherwise fail or prompt unexpectedly if
 * biometrics were previously invalidated).
 */
export async function saveBiometricCredentials(
  creds: BiometricCredentials,
): Promise<BiometricCredentialsMeta> {
  if (Platform.OS === "web") {
    throw new Error("Biometric sign-in is only supported on native devices.");
  }
  const serializedCreds = serializeBiometricCredentials(creds);
  const serializedMeta = serializeBiometricMeta({
    email: creds.email,
    serverUrl: creds.serverUrl,
  });
  if (!serializedCreds || !serializedMeta) {
    throw new Error("Invalid credentials for Face ID sign-in.");
  }

  const label = getBiometricLabel();
  await deleteQuietly(BIOMETRIC_CREDS_KEY);
  await SecureStore.setItemAsync(BIOMETRIC_CREDS_KEY, serializedCreds, {
    requireAuthentication: true,
    authenticationPrompt: `Enable ${label} sign-in for Perks`,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(BIOMETRIC_META_KEY, serializedMeta, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  const parsed = parseBiometricMeta(serializedMeta);
  if (!parsed) {
    throw new Error("Could not save Face ID metadata.");
  }
  return parsed;
}

/**
 * Prompt the user for Face ID and return their stored credentials from the
 * hardware-backed iOS Keychain.
 */
export async function readBiometricCredentials(): Promise<
  BiometricReadResult<BiometricCredentials>
> {
  const label = getBiometricLabel();
  if (Platform.OS === "web") {
    return { status: "unavailable", message: `${label} is not available on web.` };
  }
  try {
    const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: `Sign in to Perks with ${label}`,
    });
    const parsed = parseBiometricCredentials(raw);
    if (!parsed) {
      // Entry missing or invalidated after device biometric settings changed.
      await clearBiometricCredentials();
      return { status: "empty" };
    }
    return { status: "ok", value: parsed };
  } catch (err) {
    if (isBiometricCancelError(err)) {
      return { status: "canceled" };
    }
    return { status: "unavailable", message: formatBiometricError(err, label) };
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  await Promise.all([deleteQuietly(BIOMETRIC_CREDS_KEY), deleteQuietly(BIOMETRIC_META_KEY)]);
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_LOCK_ENABLED_KEY)) === "1";
  } catch {
    return false;
  }
}

/**
 * Enable Face ID app lock and immediately verify Face ID once so iOS displays
 * the permission sheet and confirms biometrics work before turning the lock on.
 */
export async function enableBiometricLock(): Promise<BiometricReadResult<true>> {
  const label = getBiometricLabel();
  if (Platform.OS === "web") {
    return { status: "unavailable", message: `${label} is not available on web.` };
  }
  try {
    await deleteQuietly(BIOMETRIC_LOCK_SENTINEL_KEY);
    await SecureStore.setItemAsync(BIOMETRIC_LOCK_SENTINEL_KEY, "perks_unlocked", {
      requireAuthentication: true,
      authenticationPrompt: `Enable ${label} lock for Perks`,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    // On iOS, `SecItemAdd` does not prompt Face ID — read back once to trigger
    // the permission / Face ID verification dialog immediately.
    const verified = await SecureStore.getItemAsync(BIOMETRIC_LOCK_SENTINEL_KEY, {
      requireAuthentication: true,
      authenticationPrompt: `Confirm ${label} to lock Perks`,
    });
    if (verified !== "perks_unlocked") {
      await disableBiometricLock();
      return { status: "empty" };
    }

    await SecureStore.setItemAsync(BIOMETRIC_LOCK_ENABLED_KEY, "1", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return { status: "ok", value: true };
  } catch (err) {
    await disableBiometricLock();
    if (isBiometricCancelError(err)) {
      return { status: "canceled" };
    }
    return { status: "unavailable", message: formatBiometricError(err, label) };
  }
}

export async function disableBiometricLock(): Promise<void> {
  await Promise.all([
    deleteQuietly(BIOMETRIC_LOCK_ENABLED_KEY),
    deleteQuietly(BIOMETRIC_LOCK_SENTINEL_KEY),
  ]);
}

export async function unlockWithBiometrics(): Promise<BiometricReadResult<true>> {
  const label = getBiometricLabel();
  if (Platform.OS === "web") {
    return { status: "unavailable", message: `${label} is not available on web.` };
  }
  try {
    const val = await SecureStore.getItemAsync(BIOMETRIC_LOCK_SENTINEL_KEY, {
      requireAuthentication: true,
      authenticationPrompt: `Unlock Perks with ${label}`,
    });
    if (val !== "perks_unlocked") {
      return { status: "empty" };
    }
    return { status: "ok", value: true };
  } catch (err) {
    if (isBiometricCancelError(err)) {
      return { status: "canceled" };
    }
    return { status: "unavailable", message: formatBiometricError(err, label) };
  }
}

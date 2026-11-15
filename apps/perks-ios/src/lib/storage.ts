import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { normalizeServerUrl } from "./format";

const TOKEN_KEY = "perks_auth_token";
const API_URL_KEY = "perks_api_base_url";

const DEFAULT_API_URL =
  normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL ?? "") ?? "http://localhost:3100";

const memoryFallback = new Map<string, string>();

async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? memoryFallback.get(key) ?? null;
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function writeItem(key: string, value: string | null): Promise<void> {
  if (value === null) {
    memoryFallback.delete(key);
  } else {
    memoryFallback.set(key, value);
  }
  if (Platform.OS === "web") {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      // Ignore web storage restrictions
    }
    return;
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Fallback already stored in memoryFallback
  }
}

export async function getStoredToken(): Promise<string | null> {
  return readItem(TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  await writeItem(TOKEN_KEY, token);
}

export async function getStoredServerUrl(): Promise<string> {
  const custom = await readItem(API_URL_KEY);
  return normalizeServerUrl(custom ?? "") ?? DEFAULT_API_URL;
}

export async function setStoredServerUrl(url: string | null): Promise<string> {
  const cleaned = url ? normalizeServerUrl(url) : null;
  await writeItem(API_URL_KEY, cleaned);
  return cleaned ?? DEFAULT_API_URL;
}

export function getDefaultServerUrl(): string {
  return DEFAULT_API_URL;
}

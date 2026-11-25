import { describe, expect, it } from "vitest";
import {
  formatBiometricError,
  isBiometricCancelError,
  isBiometricMetaForEmail,
  parseBiometricCredentials,
  parseBiometricMeta,
  serializeBiometricCredentials,
  serializeBiometricMeta,
  shouldLockOnAppStateChange,
} from "./biometrics-helpers";

describe("biometrics credential & meta serialization", () => {
  it("round-trips valid credentials and normalizes email + serverUrl", () => {
    const raw = serializeBiometricCredentials({
      email: "  kevin@example.com  ",
      password: "secret-password",
      serverUrl: "https://kch-six.vercel.app/",
    });
    expect(raw).not.toBeNull();
    expect(parseBiometricCredentials(raw)).toEqual({
      email: "kevin@example.com",
      password: "secret-password",
      serverUrl: "https://kch-six.vercel.app",
    });
  });

  it("rejects malformed or incomplete credentials", () => {
    expect(parseBiometricCredentials(null)).toBeNull();
    expect(parseBiometricCredentials("not-json")).toBeNull();
    expect(parseBiometricCredentials(JSON.stringify({ email: "a@b.com" }))).toBeNull();
    expect(
      serializeBiometricCredentials({
        email: "a@b.com",
        password: "",
        serverUrl: "https://kch-six.vercel.app",
      }),
    ).toBeNull();
    expect(
      serializeBiometricCredentials({
        email: "a@b.com",
        password: "pw",
        serverUrl: "ftp://bad.example.com",
      }),
    ).toBeNull();
  });

  it("round-trips non-sensitive metadata without including passwords", () => {
    const raw = serializeBiometricMeta({
      email: "  kevin@example.com ",
      serverUrl: "https://kch-six.vercel.app///",
    });
    expect(raw).not.toBeNull();
    expect(parseBiometricMeta(raw)).toEqual({
      email: "kevin@example.com",
      serverUrl: "https://kch-six.vercel.app",
    });
  });

  it("matches metadata email case-insensitively", () => {
    const meta = { email: "Kevin@Example.com", serverUrl: "https://kch-six.vercel.app" };
    expect(isBiometricMetaForEmail(meta, "kevin@example.com")).toBe(true);
    expect(isBiometricMetaForEmail(meta, "other@example.com")).toBe(false);
    expect(isBiometricMetaForEmail(null, "kevin@example.com")).toBe(false);
  });
});

describe("biometrics error classification", () => {
  it("recognizes iOS and Android cancel errors", () => {
    expect(isBiometricCancelError(new Error("User canceled the operation."))).toBe(true);
    expect(isBiometricCancelError(new Error("User canceled the authentication"))).toBe(true);
    expect(isBiometricCancelError(new Error("Authentication failed."))).toBe(false);
    expect(isBiometricCancelError(null)).toBe(false);
  });

  it("formats actionable user-facing error messages", () => {
    expect(
      formatBiometricError(
        new Error("Authentication failed. Provided passphrase/PIN is incorrect"),
      ),
    ).toContain("Settings");
    expect(formatBiometricError(new Error("User interaction is not allowed."))).toContain(
      "background",
    );
    expect(formatBiometricError(new Error("Something unexpected"))).toContain("Face ID");
  });
});

describe("shouldLockOnAppStateChange", () => {
  it("locks only on background transition when signed in and lock is enabled", () => {
    expect(shouldLockOnAppStateChange("background", { signedIn: true, lockEnabled: true })).toBe(
      true,
    );
    // Crucial: never lock on "inactive" because iOS emits inactive during Face ID prompts
    expect(shouldLockOnAppStateChange("inactive", { signedIn: true, lockEnabled: true })).toBe(
      false,
    );
    expect(shouldLockOnAppStateChange("active", { signedIn: true, lockEnabled: true })).toBe(false);
    expect(shouldLockOnAppStateChange("background", { signedIn: false, lockEnabled: true })).toBe(
      false,
    );
    expect(shouldLockOnAppStateChange("background", { signedIn: true, lockEnabled: false })).toBe(
      false,
    );
  });
});

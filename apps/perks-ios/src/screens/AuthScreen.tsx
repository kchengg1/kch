import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Button,
  CollapsibleSection,
  FaceIdIcon,
  FieldInput,
  SectionCard,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import {
  getBiometricLabel,
  type BiometricCredentialsMeta,
  type BiometricSignInOutcome,
} from "../lib/biometrics";
import { normalizeServerUrl } from "../lib/format";

export function AuthScreen({
  initialServerUrl,
  defaultServerUrl,
  biometricsSupported,
  biometricMeta,
  autoPromptBiometrics = false,
  sessionNotice,
  onSignIn,
  onSignUp,
  onBiometricSignIn,
  onSaveServerUrl,
}: {
  initialServerUrl: string;
  defaultServerUrl: string;
  biometricsSupported: boolean;
  biometricMeta: BiometricCredentialsMeta | null;
  autoPromptBiometrics?: boolean;
  sessionNotice?: string | null;
  onSignIn: (
    email: string,
    password: string,
    serverUrl: string,
    saveForBiometrics: boolean,
  ) => Promise<void>;
  onSignUp: (
    name: string,
    email: string,
    password: string,
    serverUrl: string,
    saveForBiometrics: boolean,
  ) => Promise<void>;
  onBiometricSignIn: () => Promise<BiometricSignInOutcome>;
  onSaveServerUrl: (url: string | null) => Promise<string>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const biometricLabel = getBiometricLabel();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(biometricMeta?.email ?? "");
  const [password, setPassword] = useState("");
  const [saveForBiometrics, setSaveForBiometrics] = useState(true);
  const [serverInput, setServerInput] = useState(initialServerUrl);
  const [busy, setBusy] = useState(false);
  const [faceIdBusy, setFaceIdBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const autoPromptedRef = useRef(false);

  const canUseFaceIdSignIn = biometricsSupported && biometricMeta !== null;

  const handleBiometricSignIn = useCallback(async () => {
    if (faceIdBusy || busy) return;
    setError(null);
    setFaceIdBusy(true);
    try {
      const outcome = await onBiometricSignIn();
      if (outcome.status === "invalid_credentials") {
        setMode("signin");
        setEmail(outcome.email);
        setSaveForBiometrics(true);
        setError(
          `Saved password is no longer valid. Sign in with your new password to update ${biometricLabel}.`,
        );
      } else if (outcome.status === "empty") {
        if (outcome.email) setEmail(outcome.email);
        setSaveForBiometrics(true);
        setError(
          `${biometricLabel} credentials expired after device settings changed. Sign in with your password to re-enable ${biometricLabel}.`,
        );
      } else if (outcome.status === "error") {
        setError(outcome.message);
      }
      // On "canceled" or "ok", stay silent (no error banner)
    } finally {
      setFaceIdBusy(false);
    }
  }, [biometricLabel, busy, faceIdBusy, onBiometricSignIn]);

  useEffect(() => {
    if (!autoPromptBiometrics || !canUseFaceIdSignIn || autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void handleBiometricSignIn();
  }, [autoPromptBiometrics, canUseFaceIdSignIn, handleBiometricSignIn]);

  async function handleSubmit() {
    setError(null);
    setSavedNotice(null);
    const normalized = normalizeServerUrl(serverInput);
    if (!normalized) {
      setError("Server URL should start with https:// or http://.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    try {
      await onSaveServerUrl(normalized);
      const shouldSaveBiometrics = biometricsSupported && saveForBiometrics;
      if (mode === "signin") {
        await onSignIn(email, password, normalized, shouldSaveBiometrics);
      } else {
        await onSignUp(name, email, password, normalized, shouldSaveBiometrics);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Perks.");
    } finally {
      setBusy(false);
    }
  }

  const showFaceIdCard = mode === "signin" && canUseFaceIdSignIn;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandHeader}>
          <Text style={styles.title}>Perks</Text>
          <Text style={styles.subtitle}>
            Credits, card offers, points, and sign-up bonuses in one place.
          </Text>
        </View>

        {sessionNotice && !error ? <Text style={styles.noticeText}>{sessionNotice}</Text> : null}

        {showFaceIdCard ? (
          <SectionCard style={styles.cardGap}>
            <View style={styles.faceIdHeader}>
              <View style={styles.faceIdIconWrap}>
                <FaceIdIcon size={24} color={colors.primary} />
              </View>
              <View style={styles.faceIdCopy}>
                <Text style={styles.faceIdTitle}>Sign in with {biometricLabel}</Text>
                <Text style={styles.faceIdEmail} numberOfLines={1}>
                  {biometricMeta.email}
                </Text>
              </View>
            </View>
            <Button
              label={`Sign in with ${biometricLabel}`}
              onPress={() => void handleBiometricSignIn()}
              loading={faceIdBusy}
              disabled={busy}
            />
          </SectionCard>
        ) : null}

        <SectionCard style={styles.cardGap}>
          <View style={styles.modeSwitch}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode("signin");
                setError(null);
              }}
              style={[styles.modeTab, mode === "signin" && styles.modeTabActive]}
            >
              <Text style={[styles.modeText, mode === "signin" && styles.modeTextActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode("signup");
                setError(null);
              }}
              style={[styles.modeTab, mode === "signup" && styles.modeTabActive]}
            >
              <Text style={[styles.modeText, mode === "signup" && styles.modeTextActive]}>
                Create account
              </Text>
            </Pressable>
          </View>

          {mode === "signup" ? (
            <FieldInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Alex"
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
            />
          ) : null}

          <FieldInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />

          <FieldInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === "signup" ? "newPassword" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "password"}
          />

          {biometricsSupported ? (
            <View style={styles.biometricRow}>
              <View style={styles.biometricTextCol}>
                <Text style={styles.biometricLabel}>Use {biometricLabel} next time</Text>
                <Text style={styles.biometricHint}>
                  Save credentials securely in iOS Keychain for one-tap sign-in.
                </Text>
              </View>
              <Switch value={saveForBiometrics} onValueChange={setSaveForBiometrics} />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label={mode === "signin" ? "Sign in" : "Create account"}
            variant={showFaceIdCard ? "secondary" : "primary"}
            onPress={() => void handleSubmit()}
            loading={busy}
            disabled={faceIdBusy}
          />
        </SectionCard>

        <CollapsibleSection
          title="Server connection"
          countLabel={serverInput.replace(/^https?:\/\//, "")}
        >
          <FieldInput
            label="Perks server URL"
            value={serverInput}
            onChangeText={(val) => {
              setServerInput(val);
              setSavedNotice(null);
            }}
            placeholder="https://perks.example.com"
            autoCapitalize="none"
            keyboardType="url"
            hint="Point this at your deployed Perks web app."
          />
          <View style={styles.serverActions}>
            <Button
              label="Save URL"
              size="sm"
              variant="secondary"
              onPress={() => {
                const normalized = normalizeServerUrl(serverInput);
                if (!normalized) {
                  setError("Server URL should start with https:// or http://.");
                  return;
                }
                void onSaveServerUrl(normalized).then((saved) => {
                  setServerInput(saved);
                  setError(null);
                  setSavedNotice(`Saved ${saved}`);
                });
              }}
            />
            {serverInput !== defaultServerUrl ? (
              <Button
                label="Reset default"
                size="sm"
                variant="ghost"
                onPress={() => {
                  void onSaveServerUrl(null).then((saved) => {
                    setServerInput(saved);
                    setSavedNotice("Reset to default URL");
                  });
                }}
              />
            ) : null}
          </View>
          {savedNotice ? <Text style={styles.savedText}>{savedNotice}</Text> : null}
        </CollapsibleSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 48,
      paddingBottom: 40,
      gap: 18,
    },
    brandHeader: {
      gap: 6,
    },
    title: {
      fontSize: 30,
      fontWeight: "700",
      color: COLORS.ink,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 21,
      color: COLORS.muted,
    },
    noticeText: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.amberInk,
      backgroundColor: COLORS.amberBg,
      borderColor: COLORS.amberBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    cardGap: {
      gap: 14,
    },
    faceIdHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    faceIdIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    faceIdCopy: {
      flex: 1,
      gap: 2,
    },
    faceIdTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    faceIdEmail: {
      fontSize: 13,
      color: COLORS.muted,
    },
    modeSwitch: {
      flexDirection: "row",
      backgroundColor: COLORS.subtle,
      borderRadius: 10,
      padding: 3,
    },
    modeTab: {
      flex: 1,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    modeTabActive: {
      backgroundColor: COLORS.card,
    },
    modeText: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.muted,
    },
    modeTextActive: {
      color: COLORS.ink,
    },
    biometricRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minHeight: 44,
    },
    biometricTextCol: {
      flex: 1,
      gap: 2,
    },
    biometricLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.ink,
    },
    biometricHint: {
      fontSize: 12,
      lineHeight: 16,
      color: COLORS.muted,
    },
    errorText: {
      fontSize: 13,
      color: COLORS.redInk,
      backgroundColor: COLORS.redBg,
      borderColor: COLORS.redBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    serverActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    savedText: {
      fontSize: 12,
      color: COLORS.greenInk,
    },
  });

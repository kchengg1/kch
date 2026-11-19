import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Button,
  CollapsibleSection,
  FieldInput,
  SectionCard,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import { normalizeServerUrl } from "../lib/format";

export function AuthScreen({
  initialServerUrl,
  defaultServerUrl,
  onSignIn,
  onSignUp,
  onSaveServerUrl,
}: {
  initialServerUrl: string;
  defaultServerUrl: string;
  onSignIn: (email: string, password: string, serverUrl: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string, serverUrl: string) => Promise<void>;
  onSaveServerUrl: (url: string | null) => Promise<string>;
}) {
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverInput, setServerInput] = useState(initialServerUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

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
      if (mode === "signin") {
        await onSignIn(email, password, normalized);
      } else {
        await onSignUp(name, email, password, normalized);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Perks.");
    } finally {
      setBusy(false);
    }
  }

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
            />
          ) : null}

          <FieldInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FieldInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            label={mode === "signin" ? "Sign in" : "Create account"}
            onPress={() => void handleSubmit()}
            loading={busy}
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
    cardGap: {
      gap: 14,
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

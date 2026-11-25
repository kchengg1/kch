import React, { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  FaceIdIcon,
  FieldInput,
  SectionCard,
  SegmentedBar,
  useTheme,
  useThemedStyles,
  type ThemeColors,
  type ThemeMode,
} from "../components/ui";
import {
  getBiometricLabel,
  isBiometricMetaForEmail,
  type BiometricCredentialsMeta,
} from "../lib/biometrics";
import { formatDate } from "../lib/format";
import { formatLastActive } from "../lib/last-active";
import type { MobileActionPayload, MobileActionResponse, MobileBootstrap } from "../types";

const APPEARANCE_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export function SettingsModal({
  visible,
  data,
  serverUrl,
  busyKey,
  biometricsSupported,
  biometricMeta,
  biometricLockEnabled,
  onClose,
  onRunRawAction,
  onEnableBiometricSignIn,
  onDisableBiometricSignIn,
  onToggleBiometricLock,
  onSignOut,
}: {
  visible: boolean;
  data: MobileBootstrap;
  serverUrl: string;
  busyKey: string | null;
  biometricsSupported: boolean;
  biometricMeta: BiometricCredentialsMeta | null;
  biometricLockEnabled: boolean;
  onClose: () => void;
  onRunRawAction: (payload: MobileActionPayload, key: string) => Promise<MobileActionResponse>;
  onEnableBiometricSignIn: (password: string) => Promise<void>;
  onDisableBiometricSignIn: () => Promise<void>;
  onToggleBiometricLock: (enabled: boolean) => Promise<{ ok: boolean; message?: string }>;
  onSignOut: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const biometricLabel = getBiometricLabel();
  const [digestFeedback, setDigestFeedback] = useState<string | null>(null);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<{
    text: string;
    tone: "info" | "error";
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setShowPasswordSetup(false);
      setSetupPassword("");
      setBiometricFeedback(null);
    }
  }, [visible]);

  const signInEnabledForUser = isBiometricMetaForEmail(biometricMeta, data.user.email);

  async function handleSignInSwitch(next: boolean) {
    setBiometricFeedback(null);
    if (!next) {
      setShowPasswordSetup(false);
      setSetupPassword("");
      setBiometricBusy(true);
      try {
        await onDisableBiometricSignIn();
        setBiometricFeedback({ text: `${biometricLabel} sign-in turned off.`, tone: "info" });
      } finally {
        setBiometricBusy(false);
      }
      return;
    }
    setShowPasswordSetup(true);
  }

  async function handleConfirmPasswordSetup() {
    if (!setupPassword) {
      setBiometricFeedback({
        text: `Enter your password to enable ${biometricLabel} sign-in.`,
        tone: "error",
      });
      return;
    }
    setBiometricFeedback(null);
    setBiometricBusy(true);
    try {
      await onEnableBiometricSignIn(setupPassword);
      setSetupPassword("");
      setShowPasswordSetup(false);
      setBiometricFeedback({
        text: `${biometricLabel} sign-in enabled for ${data.user.email}.`,
        tone: "info",
      });
    } catch (err) {
      setBiometricFeedback({
        text: err instanceof Error ? err.message : `Could not enable ${biometricLabel} sign-in.`,
        tone: "error",
      });
    } finally {
      setBiometricBusy(false);
    }
  }

  async function handleLockSwitch(next: boolean) {
    if (lockBusy) return;
    setBiometricFeedback(null);
    setLockBusy(true);
    try {
      const res = await onToggleBiometricLock(next);
      if (res.message) {
        setBiometricFeedback({ text: res.message, tone: res.ok ? "info" : "error" });
      }
    } finally {
      setLockBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: Platform.OS === "android" ? insets.top : 8 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Button label="Done" size="sm" variant="secondary" onPress={onClose} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <Text style={styles.noteText}>
              Choose Light, Dark, or match your iPhone&rsquo;s system appearance automatically.
            </Text>
            <SegmentedBar options={APPEARANCE_OPTIONS} value={mode} onChange={setMode} />
          </SectionCard>

          <SectionCard style={styles.cardGap}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.faceIdBadge}>
                <FaceIdIcon size={18} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{biometricLabel}</Text>
            </View>

            {biometricsSupported ? (
              <>
                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={styles.switchLabel}>Sign in with {biometricLabel}</Text>
                    <Text style={styles.metaText}>
                      {signInEnabledForUser
                        ? `Saved in iOS Keychain for ${data.user.email}.`
                        : "Save credentials securely so you can sign back in with one tap."}
                    </Text>
                  </View>
                  <Switch
                    value={signInEnabledForUser || showPasswordSetup}
                    disabled={biometricBusy}
                    onValueChange={(next) => void handleSignInSwitch(next)}
                  />
                </View>

                {showPasswordSetup ? (
                  <View style={styles.passwordSetupBox}>
                    <FieldInput
                      label={`Confirm password for ${data.user.email}`}
                      value={setupPassword}
                      onChangeText={setSetupPassword}
                      placeholder="••••••••"
                      secureTextEntry
                      autoCapitalize="none"
                      textContentType="password"
                      autoComplete="password"
                    />
                    <View style={styles.setupActions}>
                      <Button
                        label={`Save & enable ${biometricLabel}`}
                        size="sm"
                        loading={biometricBusy}
                        onPress={() => void handleConfirmPasswordSetup()}
                      />
                      <Button
                        label="Cancel"
                        size="sm"
                        variant="ghost"
                        disabled={biometricBusy}
                        onPress={() => {
                          setShowPasswordSetup(false);
                          setSetupPassword("");
                          setBiometricFeedback(null);
                        }}
                      />
                    </View>
                  </View>
                ) : null}

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                  <View style={styles.switchTextCol}>
                    <Text style={styles.switchLabel}>Require {biometricLabel} to open</Text>
                    <Text style={styles.metaText}>
                      Lock Perks when launching or returning from the background.
                    </Text>
                  </View>
                  <Switch
                    value={biometricLockEnabled}
                    disabled={lockBusy}
                    onValueChange={(next) => void handleLockSwitch(next)}
                  />
                </View>

                {biometricFeedback ? (
                  <Text
                    style={
                      biometricFeedback.tone === "error" ? styles.errorText : styles.feedbackText
                    }
                  >
                    {biometricFeedback.text}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.noteText}>
                {biometricLabel} isn&rsquo;t available on this device. Set up {biometricLabel} in
                iPhone Settings to sign in and unlock Perks with {biometricLabel}.
              </Text>
            )}
          </SectionCard>

          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionTitle}>Email digest</Text>
            <Text style={styles.noteText}>
              Monday morning summary of credits ending soon, active sign-up bonuses, and expiring
              offers.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Send weekly digest</Text>
              <Switch
                value={data.settings.digestEnabled}
                onValueChange={(enabled) => {
                  setDigestFeedback(null);
                  void onRunRawAction(
                    { type: "settings.setDigest", enabled },
                    "settings.setDigest",
                  );
                }}
              />
            </View>

            {data.settings.lastDigestOn ? (
              <Text style={styles.metaText}>
                Last sent {formatDate(data.settings.lastDigestOn, data.today)}.
              </Text>
            ) : null}

            <Button
              label="Send me one now"
              size="sm"
              variant="secondary"
              loading={busyKey === "settings.sendDigestNow"}
              onPress={() => {
                setDigestFeedback(null);
                void onRunRawAction(
                  { type: "settings.sendDigestNow" },
                  "settings.sendDigestNow",
                ).then((res) => {
                  setDigestFeedback(res.message ?? "Sent.");
                });
              }}
            />

            {digestFeedback ? <Text style={styles.feedbackText}>{digestFeedback}</Text> : null}
          </SectionCard>

          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionTitle}>Group rankings</Text>
            <Text style={styles.noteText}>
              Share card credit totals and rankings on the People tab and card pages. Shared Amex
              and Chase offers still appear either way.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Share my rankings</Text>
              <Switch
                value={data.settings.shareRankings}
                onValueChange={(enabled) => {
                  void onRunRawAction(
                    { type: "settings.setShareRankings", enabled },
                    "settings.setShareRankings",
                  );
                }}
              />
            </View>

            <Text style={styles.metaText}>
              {data.settings.shareRankings
                ? "Currently sharing your credit progress with the group."
                : "Hidden — your credit totals and card breakdown are private."}
            </Text>
          </SectionCard>

          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Name</Text>
              <Text style={styles.kvValue}>{data.user.name}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Email</Text>
              <Text style={styles.kvValue}>{data.user.email}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Last active</Text>
              <Text style={styles.kvValue}>{formatLastActive(data.settings.lastActiveAt)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Server</Text>
              <Text style={styles.kvValue} numberOfLines={1}>
                {serverUrl}
              </Text>
            </View>

            <Button label="Sign out" variant="danger" onPress={() => void onSignOut()} />
          </SectionCard>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: COLORS.ink,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 14,
    },
    cardGap: {
      gap: 10,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    faceIdBadge: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.muted,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minHeight: 42,
    },
    switchTextCol: {
      flex: 1,
      gap: 2,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: COLORS.ink,
    },
    passwordSetupBox: {
      backgroundColor: COLORS.subtle,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    setupActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.border,
    },
    metaText: {
      fontSize: 12,
      lineHeight: 16,
      color: COLORS.muted,
    },
    feedbackText: {
      fontSize: 13,
      color: COLORS.greenInk,
      fontWeight: "500",
    },
    errorText: {
      fontSize: 13,
      color: COLORS.redInk,
      fontWeight: "500",
    },
    kvRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    kvLabel: {
      fontSize: 13,
      color: COLORS.muted,
    },
    kvValue: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.ink,
      flexShrink: 1,
    },
  });

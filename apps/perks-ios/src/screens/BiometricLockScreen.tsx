import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import {
  Button,
  FaceIdIcon,
  SectionCard,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import { getBiometricLabel, type BiometricReadResult } from "../lib/biometrics";

export function BiometricLockScreen({
  email,
  onUnlock,
  onSignOut,
}: {
  email?: string | null;
  onUnlock: () => Promise<BiometricReadResult<true>>;
  onSignOut: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const label = getBiometricLabel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAttemptedRef = useRef(false);

  const handleUnlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await onUnlock();
      if (res.status === "unavailable") {
        setError(res.message);
      } else if (res.status === "empty") {
        setError(`${label} settings changed. Sign out and sign back in to re-enable it.`);
      }
    } finally {
      setBusy(false);
    }
  }, [label, onUnlock]);

  // Only auto-prompt once the app is truly foregrounded ("active"). When the lock screen mounts
  // while entering "background" (to obscure sensitive data in the iOS app switcher), wait until
  // the user returns to the app before triggering the Face ID sheet.
  useEffect(() => {
    const attemptIfActive = (state: string | null | undefined) => {
      if (state === "active" && !autoAttemptedRef.current) {
        autoAttemptedRef.current = true;
        void handleUnlock();
      }
    };
    attemptIfActive(AppState.currentState);
    const sub = AppState.addEventListener("change", attemptIfActive);
    return () => sub.remove();
  }, [handleUnlock]);

  return (
    <View style={styles.root}>
      <SectionCard style={styles.card}>
        <View style={styles.iconBadge}>
          <FaceIdIcon size={34} color={colors.primary} />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Perks is locked</Text>
          <Text style={styles.subtitle}>
            Use {label} to view your cards, credits, and points
            {email ? ` (${email})` : ""}.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            label={`Unlock with ${label}`}
            onPress={() => void handleUnlock()}
            loading={busy}
          />
          <Button
            label="Sign out"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => void onSignOut()}
          />
        </View>
      </SectionCard>
    </View>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      alignItems: "center",
      paddingVertical: 26,
      paddingHorizontal: 20,
      gap: 16,
    },
    iconBadge: {
      width: 68,
      height: 68,
      borderRadius: 20,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    textBlock: {
      alignItems: "center",
      gap: 6,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: COLORS.ink,
      letterSpacing: -0.3,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: COLORS.muted,
      textAlign: "center",
    },
    errorText: {
      width: "100%",
      fontSize: 13,
      color: COLORS.redInk,
      backgroundColor: COLORS.redBg,
      borderColor: COLORS.redBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      textAlign: "center",
    },
    actions: {
      width: "100%",
      gap: 10,
      marginTop: 4,
    },
  });

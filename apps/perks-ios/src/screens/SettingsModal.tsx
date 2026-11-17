import React, { useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, COLORS, SectionCard } from "../components/ui";
import { formatDate } from "../lib/format";
import { formatLastActive } from "../lib/last-active";
import type { MobileActionPayload, MobileActionResponse, MobileBootstrap } from "../types";

export function SettingsModal({
  visible,
  data,
  serverUrl,
  busyKey,
  onClose,
  onRunRawAction,
  onSignOut,
}: {
  visible: boolean;
  data: MobileBootstrap;
  serverUrl: string;
  busyKey: string | null;
  onClose: () => void;
  onRunRawAction: (payload: MobileActionPayload, key: string) => Promise<MobileActionResponse>;
  onSignOut: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [digestFeedback, setDigestFeedback] = useState<string | null>(null);

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
        >
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

const styles = StyleSheet.create({
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
    minHeight: 40,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.ink,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  feedbackText: {
    fontSize: 13,
    color: COLORS.greenInk,
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

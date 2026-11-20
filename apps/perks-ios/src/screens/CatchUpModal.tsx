import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  CardSwatch,
  FieldInput,
  NUM_STYLE,
  SectionCard,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import { formatCents } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  MobileActionPayload,
  MobileActionResponse,
  MobileBootstrap,
  StatementPreviewPayload,
} from "../types";

export function CatchUpModal({
  visible,
  data,
  busyKey,
  onClose,
  onRunRawAction,
}: {
  visible: boolean;
  data: MobileBootstrap;
  busyKey: string | null;
  onClose: () => void;
  onRunRawAction: (payload: MobileActionPayload, key: string) => Promise<MobileActionResponse>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const openCards = data.cards.filter((c) => !c.closed);
  const [selectedCardId, setSelectedCardId] = useState<string>(openCards[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<StatementPreviewPayload | null>(null);
  const [assignedBenefits, setAssignedBenefits] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const activeCardId = openCards.some((c) => c.id === selectedCardId)
    ? selectedCardId
    : (openCards[0]?.id ?? "");

  const inAppItems = openCards.flatMap((card) =>
    card.benefits
      .filter((b) => b.tracked && !b.expired && b.inApp && b.cadence !== "perk")
      .map((benefit) => ({ card, benefit })),
  );

  async function pasteClipboardCsv() {
    const text = await Clipboard.getStringAsync();
    if (text.trim()) {
      setCsvText(text);
    }
  }

  async function runPreview() {
    if (!activeCardId) return;
    setNotice(null);
    const res = await onRunRawAction(
      { type: "statement.preview", cardId: activeCardId, csv: csvText },
      "statement.preview",
    );
    if (res.statementPreview) {
      setPreview(res.statementPreview);
      const initialMap: Record<number, string> = {};
      res.statementPreview.rows.forEach((row, idx) => {
        if (row.suggestedBenefitId) {
          initialMap[idx] = row.suggestedBenefitId;
        }
      });
      setAssignedBenefits(initialMap);
    }
  }

  async function saveMatchedCredits() {
    if (!preview || !activeCardId) return;
    const credits = preview.rows
      .map((row, idx) => ({
        date: row.date,
        amountCents: row.amountCents,
        benefitId: assignedBenefits[idx] ?? "",
      }))
      .filter((c) => Boolean(c.benefitId));

    const res = await onRunRawAction(
      { type: "usage.saveStatementCredits", cardId: activeCardId, credits },
      "usage.saveStatementCredits",
    );
    setNotice(res.message ?? "Saved matched statement credits.");
    setPreview(null);
    setCsvText("");
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: Platform.OS === "android" ? insets.top : 8 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.flexShrink}>
            <Text style={styles.title}>Catch up</Text>
            <Text style={styles.subtitle}>
              Match statement credits from CSV and tick off in-app credits.
            </Text>
          </View>
          <Button label="Done" size="sm" variant="secondary" onPress={onClose} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {notice ? <Text style={styles.noticeBox}>{notice}</Text> : null}

          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionHeading}>1. Statement CSV credits</Text>
            <Text style={styles.noteText}>
              Paste exported CSV lines from Amex, Chase, Capital One, or Citi to detect statement
              credits automatically.
            </Text>

            <View style={styles.cardPills}>
              {openCards.map((card) => {
                const selected = card.id === activeCardId;
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => {
                      tapHaptic();
                      setSelectedCardId(card.id);
                      setPreview(null);
                    }}
                    style={[styles.cardPill, selected && styles.cardPillActive]}
                  >
                    <CardSwatch style={card.style} />
                    <Text
                      style={[styles.cardPillText, selected && styles.cardPillTextActive]}
                      numberOfLines={1}
                    >
                      {card.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rowActions}>
              <Button
                label="Paste CSV from clipboard"
                size="sm"
                variant="secondary"
                onPress={() => void pasteClipboardCsv()}
              />
            </View>

            <FieldInput
              label="CSV text"
              value={csvText}
              onChangeText={setCsvText}
              multiline
              placeholder={
                "Date,Description,Amount\n2026-11-04,AMEX AIRLINE FEE REIMBURSEMENT,-48.00"
              }
            />

            <Button
              label="Scan statement"
              size="sm"
              disabled={!activeCardId || !csvText.trim()}
              loading={busyKey === "statement.preview"}
              onPress={() => void runPreview()}
            />

            {preview ? (
              <View style={styles.previewWrap}>
                <Text style={styles.previewSummary}>
                  Found {preview.rows.length} credit rows ({preview.charges} regular charges
                  skipped).
                </Text>
                {preview.rows.map((row, idx) => {
                  const chosen = assignedBenefits[idx] ?? "";
                  return (
                    <View key={`${row.date}:${idx}`} style={styles.previewRow}>
                      <View style={styles.previewTop}>
                        <View style={styles.flexShrink}>
                          <Text style={styles.rowDesc}>{row.description}</Text>
                          <Text style={styles.rowDate}>{row.date}</Text>
                        </View>
                        <Text style={[styles.rowAmount, NUM_STYLE]}>
                          {formatCents(row.amountCents)}
                        </Text>
                      </View>
                      <View style={styles.benefitSelectorWrap}>
                        <Pressable
                          onPress={() => setAssignedBenefits((prev) => ({ ...prev, [idx]: "" }))}
                          style={[styles.miniPill, !chosen && styles.miniPillActive]}
                        >
                          <Text style={[styles.miniPillText, !chosen && styles.miniPillTextActive]}>
                            Skip
                          </Text>
                        </Pressable>
                        {preview.benefits.map((b) => {
                          const active = chosen === b.id;
                          return (
                            <Pressable
                              key={b.id}
                              onPress={() =>
                                setAssignedBenefits((prev) => ({ ...prev, [idx]: b.id }))
                              }
                              style={[styles.miniPill, active && styles.miniPillActive]}
                            >
                              <Text
                                style={[styles.miniPillText, active && styles.miniPillTextActive]}
                              >
                                {b.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                {preview.rows.length > 0 ? (
                  <Button
                    label="Save matched credits"
                    loading={busyKey === "usage.saveStatementCredits"}
                    onPress={() => void saveMatchedCredits()}
                  />
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          <SectionCard style={styles.cardGap}>
            <Text style={styles.sectionHeading}>2. Credits applied in an app</Text>
            <Text style={styles.noteText}>
              Uber Cash, DoorDash, Lyft, and travel portal credits never show as statement credits.
              Tap any period you already used.
            </Text>

            {inAppItems.length === 0 ? (
              <Text style={styles.noteText}>No active in-app credits on your open cards.</Text>
            ) : (
              inAppItems.map(({ card, benefit }, idx) => (
                <View key={benefit.id} style={[styles.inAppBlock, idx > 0 && styles.divider]}>
                  <View style={styles.inAppHead}>
                    <CardSwatch style={card.style} />
                    <View style={styles.flexShrink}>
                      <Text style={styles.rowDesc}>{benefit.name}</Text>
                      <Text style={styles.rowDate}>
                        {card.name} · {formatCents(benefit.amountCents)}{" "}
                        {benefit.cadenceLabel.toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.chipWrap}>
                    {benefit.periods
                      .filter((p) => !p.future)
                      .map((chip) => {
                        const key = `catchup:${benefit.id}:${chip.key}`;
                        return (
                          <Pressable
                            key={chip.key}
                            disabled={busyKey === key}
                            onPress={() => {
                              tapHaptic();
                              void onRunRawAction(
                                chip.full
                                  ? {
                                      type: "usage.clearUsed",
                                      benefitId: benefit.id,
                                      periodKey: chip.key,
                                    }
                                  : {
                                      type: "usage.markUsed",
                                      benefitId: benefit.id,
                                      periodKey: chip.key,
                                    },
                                key,
                              );
                            }}
                            style={[styles.miniPill, chip.full && styles.miniPillDone]}
                          >
                            <Text
                              style={[styles.miniPillText, chip.full && styles.miniPillTextDone]}
                            >
                              {chip.full ? "✓ " : ""}
                              {chip.shortLabel}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              ))
            )}
          </SectionCard>
        </ScrollView>
      </KeyboardAvoidingView>
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
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    flexShrink: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: COLORS.ink,
    },
    subtitle: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 14,
    },
    noticeBox: {
      fontSize: 13,
      color: COLORS.greenInk,
      backgroundColor: COLORS.greenBg,
      borderColor: COLORS.greenBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    cardGap: {
      gap: 10,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.muted,
    },
    cardPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    cardPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.borderStrong,
      backgroundColor: COLORS.card,
    },
    cardPillActive: {
      borderColor: COLORS.ink,
      backgroundColor: COLORS.subtle,
    },
    cardPillText: {
      fontSize: 13,
      fontWeight: "500",
      color: COLORS.muted,
      maxWidth: 190,
    },
    cardPillTextActive: {
      color: COLORS.ink,
      fontWeight: "700",
    },
    rowActions: {
      flexDirection: "row",
      gap: 8,
    },
    previewWrap: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 10,
      gap: 10,
    },
    previewSummary: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.ink,
    },
    previewRow: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      padding: 10,
      gap: 8,
      backgroundColor: COLORS.bg,
    },
    previewTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    rowDesc: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.ink,
    },
    rowDate: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 1,
    },
    rowAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.greenInk,
    },
    benefitSelectorWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    miniPill: {
      minHeight: 34,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.borderStrong,
      backgroundColor: COLORS.card,
      justifyContent: "center",
    },
    miniPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    miniPillDone: {
      backgroundColor: COLORS.greenBg,
      borderColor: COLORS.greenBorder,
    },
    miniPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.ink,
    },
    miniPillTextActive: {
      color: COLORS.primaryInk,
    },
    miniPillTextDone: {
      color: COLORS.greenInk,
    },
    inAppBlock: {
      gap: 8,
      paddingTop: 4,
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 10,
    },
    inAppHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
  });

import React from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  CardSwatch,
  CollapsibleSection,
  NUM_STYLE,
  SectionCard,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import { dueLabel, formatCents } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  BenefitStatus,
  MobileActionPayload,
  MobileBootstrap,
  MobileYearEndNote,
} from "../types";

const NOTE_BADGE: Record<
  MobileYearEndNote["kind"],
  { label: string; tone: "neutral" | "amber" | "green" }
> = {
  cap: { label: "Cap resets", tone: "neutral" },
  goal: { label: "Spend goal", tone: "green" },
  change: { label: "Changing", tone: "amber" },
  info: { label: "Note", tone: "neutral" },
};

function ChecklistCreditRow({
  item,
  busyKey,
  onAction,
  onOpenCard,
}: {
  item: BenefitStatus;
  busyKey: string | null;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const periodKey = item.period?.key ?? "";
  const actionKey = `ye:${item.benefit.id}:${periodKey}`;
  const due = dueLabel(item.daysLeft);
  const urgent = item.daysLeft !== null && item.daysLeft <= 7;

  return (
    <View style={styles.creditRow}>
      <View style={styles.creditTop}>
        <Pressable
          onPress={() => {
            tapHaptic();
            onOpenCard(item.card.id);
          }}
          style={styles.cardIdentity}
        >
          <CardSwatch style={item.cardStyle} />
          <View style={styles.flexShrink}>
            <Text style={styles.itemTitle}>{item.benefit.name}</Text>
            <Text style={styles.metaText} numberOfLines={1}>
              {item.card.name}
              {item.period ? ` · ${item.period.label}` : ""}
            </Text>
          </View>
        </Pressable>
        {item.benefit.amountCents > 0 ? (
          <Text style={[styles.amountText, NUM_STYLE]}>{formatCents(item.remainingCents)}</Text>
        ) : null}
      </View>

      <View style={styles.rowActions}>
        <View style={styles.badgeWrap}>
          {due ? <Badge label={due} tone={urgent ? "red" : "amber"} /> : null}
          {item.benefit.enrollRequired && !item.benefit.enrolled ? (
            <Badge label="Needs enrollment" tone="amber" />
          ) : null}
        </View>
        {periodKey ? (
          <Button
            label="Mark used"
            size="sm"
            loading={busyKey === actionKey}
            onPress={() =>
              void onAction(
                { type: "usage.markUsed", benefitId: item.benefit.id, periodKey },
                actionKey,
              )
            }
          />
        ) : null}
      </View>
    </View>
  );
}

export const YearEndModal = React.memo(function YearEndModal({
  visible,
  data,
  busyKey,
  onClose,
  onAction,
  onOpenCard,
  onOpenReferrals,
}: {
  visible: boolean;
  data: MobileBootstrap;
  busyKey: string | null;
  onClose: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
  onOpenReferrals: () => void;
}) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { yearEnd } = data;
  const year = data.today.slice(0, 4);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: Platform.OS === "android" ? insets.top : 8 }]}>
        <View style={styles.header}>
          <View style={styles.flexShrink}>
            <Text style={styles.title}>Year-end checklist</Text>
            <Text style={[styles.subtitle, NUM_STYLE]}>
              {yearEnd.daysLeft < 0
                ? "Calendar-year credits have reset."
                : `${yearEnd.daysLeft === 0 ? "Today is" : `${yearEnd.daysLeft} day${yearEnd.daysLeft === 1 ? "" : "s"} until`} Dec 31`}
            </Text>
          </View>
          <Button label="Done" size="sm" variant="secondary" onPress={onClose} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
        >
          {data.overview.catalogUpdateCards.length > 0 ? (
            <SectionCard style={styles.highlightCard}>
              <Text style={styles.sectionTitle}>Credits changed for {year}</Text>
              <Text style={styles.noteText}>
                The card catalog was updated after these cards were added. Apply updates so your
                checklist is complete.
              </Text>
              {data.overview.catalogUpdateCards.map((u, idx) => (
                <View key={u.cardId} style={[styles.updateItem, idx > 0 && styles.rowDivider]}>
                  <View style={styles.cardIdentity}>
                    <CardSwatch style={u.cardStyle} />
                    <Text style={styles.itemTitle}>{u.cardName}</Text>
                  </View>
                  {u.summary.map((line, i) => (
                    <Text key={i} style={styles.metaText}>
                      • {line}
                    </Text>
                  ))}
                  <Button
                    label={`Apply ${u.count} update${u.count === 1 ? "" : "s"}`}
                    size="sm"
                    loading={busyKey === `catalog.apply:${u.cardId}`}
                    onPress={() =>
                      void onAction(
                        { type: "card.applyCatalogUpdates", cardId: u.cardId },
                        `catalog.apply:${u.cardId}`,
                      )
                    }
                  />
                </View>
              ))}
            </SectionCard>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Use before December 31</Text>
            <Text style={styles.noteText}>
              Calendar-year, half-year, Q4, and December credits. Charges have to post by Dec 31, so
              leave a few days.
            </Text>
            {yearEnd.expiring.length === 0 ? (
              <SectionCard>
                <Text style={styles.noteText}>Nothing left to use this year.</Text>
              </SectionCard>
            ) : (
              <SectionCard style={styles.divideCard}>
                {yearEnd.expiring.map((item, idx) => (
                  <View
                    key={`${item.benefit.id}:${item.period?.key ?? idx}`}
                    style={idx > 0 ? styles.rowDivider : undefined}
                  >
                    <ChecklistCreditRow
                      item={item}
                      busyKey={busyKey}
                      onAction={onAction}
                      onOpenCard={(cardId) => {
                        onClose();
                        onOpenCard(cardId);
                      }}
                    />
                  </View>
                ))}
              </SectionCard>
            )}
            {yearEnd.goneForGoodNames.length > 0 ? (
              <Text style={styles.goneText}>
                {yearEnd.goneForGoodNames.join(", ")}{" "}
                {yearEnd.goneForGoodNames.length === 1 ? "doesn't" : "don't"} come back after this.
              </Text>
            ) : null}
          </View>

          {yearEnd.renewing.length > 0 ? (
            <CollapsibleSection
              title={`No rush: ${yearEnd.renewingCount} cardmember-year credit${yearEnd.renewingCount === 1 ? "" : "s"}`}
              countLabel={formatCents(yearEnd.renewingCents)}
            >
              {() => (
                <View style={styles.renewStack}>
                  <Text style={styles.noteText}>
                    These renew on each card’s anniversary instead of January 1.
                  </Text>
                  {yearEnd.renewing.map((item, idx) => (
                    <View
                      key={`${item.benefit.id}:${item.period?.key ?? idx}`}
                      style={idx > 0 ? styles.rowDivider : undefined}
                    >
                      <ChecklistCreditRow
                        item={item}
                        busyKey={busyKey}
                        onAction={onAction}
                        onOpenCard={(cardId) => {
                          onClose();
                          onOpenCard(cardId);
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </CollapsibleSection>
          ) : null}

          {data.overview.spendTargets.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Spend goals reset January 1</Text>
              <SectionCard style={styles.divideCard}>
                {data.overview.spendTargets.map((g, idx) => (
                  <View key={g.id} style={[styles.goalRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.flexShrink}>
                      <Text style={styles.itemTitle}>
                        {g.cardName}: {g.name}
                      </Text>
                      <Text style={styles.metaText}>{g.reward}</Text>
                    </View>
                    {g.spentCents >= g.targetCents ? (
                      <Badge label="Met" tone="green" />
                    ) : (
                      <Text style={[styles.metaStrong, NUM_STYLE]}>
                        {formatCents(g.targetCents - g.spentCents)} to go
                      </Text>
                    )}
                  </View>
                ))}
              </SectionCard>
            </View>
          ) : null}

          {yearEnd.cardNotes.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Your cards at year end</Text>
              <SectionCard style={styles.divideCard}>
                {yearEnd.cardNotes.map((cn, idx) => (
                  <View key={cn.cardId} style={[styles.cardNoteItem, idx > 0 && styles.rowDivider]}>
                    <View style={styles.cardIdentity}>
                      <CardSwatch style={cn.cardStyle} />
                      <Text style={styles.itemTitle}>{cn.cardName}</Text>
                    </View>
                    {cn.notes.map((n, nIdx) => {
                      const b = NOTE_BADGE[n.kind];
                      return (
                        <View key={nIdx} style={styles.noteLine}>
                          <Badge label={b.label} tone={b.tone} />
                          <Text style={[styles.noteText, styles.flexShrink]}>{n.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </SectionCard>
            </View>
          ) : null}

          {yearEnd.hasAmex || yearEnd.hasChase ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Referral limits reset January 1</Text>
              <SectionCard style={styles.refCard}>
                {yearEnd.hasAmex ? (
                  <Text style={styles.noteText}>
                    <Text style={styles.boldInk}>Amex:</Text> points from up to 5 referrals a
                    calendar year.
                  </Text>
                ) : null}
                {yearEnd.hasChase ? (
                  <Text style={styles.noteText}>
                    <Text style={styles.boldInk}>Chase:</Text> 50,000 to 200,000 referral points a
                    year, depending on the card.
                  </Text>
                ) : null}
                <Button
                  label={
                    data.referrals.mine.length > 0
                      ? `Your ${data.referrals.mine.length} referral link${data.referrals.mine.length === 1 ? "" : "s"}`
                      : "Add your referral links"
                  }
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onOpenReferrals();
                  }}
                />
              </SectionCard>
            </View>
          ) : null}

          {yearEnd.applyNow.length > 0 || yearEnd.applyLater.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Applying before year end</Text>
              <SectionCard style={styles.divideCard}>
                {yearEnd.applyNow.map((tip, idx) => (
                  <View key={tip.name} style={[styles.tipItem, idx > 0 && styles.rowDivider]}>
                    <View style={styles.tipHeader}>
                      <Text style={styles.itemTitle}>{tip.name}</Text>
                      <Badge label="Good in December" tone="green" />
                    </View>
                    <Text style={styles.noteText}>{tip.text}</Text>
                  </View>
                ))}
                {yearEnd.applyLater.map((tip, idx) => (
                  <View
                    key={tip.name}
                    style={[
                      styles.tipItem,
                      (idx > 0 || yearEnd.applyNow.length > 0) && styles.rowDivider,
                    ]}
                  >
                    <View style={styles.tipHeader}>
                      <Text style={styles.itemTitle}>{tip.name}</Text>
                      <Badge label="Wait until January" tone="neutral" />
                    </View>
                    <Text style={styles.noteText}>{tip.text}</Text>
                  </View>
                ))}
              </SectionCard>
            </View>
          ) : null}

          <Pressable onPress={() => void Linking.openURL(yearEnd.source.url)}>
            <Text style={styles.sourceText}>
              Based on {yearEnd.source.title}. Confirm terms with the issuer before a big purchase.
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
});

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
      gap: 12,
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
    subtitle: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 18,
    },
    highlightCard: {
      gap: 10,
      borderColor: COLORS.borderStrong,
    },
    sectionBlock: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    divideCard: {
      paddingVertical: 4,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    creditRow: {
      paddingVertical: 10,
      gap: 8,
    },
    creditTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    cardIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    flexShrink: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.ink,
    },
    metaText: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 1,
    },
    metaStrong: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.ink,
    },
    amountText: {
      fontSize: 15,
      fontWeight: "700",
      color: COLORS.ink,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    badgeWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    goneText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.redInk,
    },
    renewStack: {
      gap: 8,
    },
    updateItem: {
      paddingTop: 8,
      gap: 6,
    },
    goalRow: {
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    cardNoteItem: {
      paddingVertical: 10,
      gap: 8,
    },
    noteLine: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.muted,
    },
    boldInk: {
      fontWeight: "600",
      color: COLORS.ink,
    },
    refCard: {
      gap: 8,
    },
    tipItem: {
      paddingVertical: 10,
      gap: 4,
    },
    tipHeader: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    sourceText: {
      fontSize: 12,
      color: COLORS.faint,
      textDecorationLine: "underline",
      lineHeight: 17,
    },
  });

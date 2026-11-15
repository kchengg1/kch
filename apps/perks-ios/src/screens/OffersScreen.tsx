import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Badge,
  Button,
  CardSwatch,
  CollapsibleSection,
  COLORS,
  FieldInput,
  NUM_STYLE,
  SectionCard,
} from "../components/ui";
import { dueLabel, formatCents, formatDate, sortOfferGroups } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  MobileActionPayload,
  MobileBootstrap,
  MobileOfferGroup,
  OfferSortKey,
  OfferStatus,
} from "../types";

function OfferGroupCard({
  group,
  busyKey,
  onAction,
  onRecordUndo,
}: {
  group: MobileOfferGroup;
  busyKey: string | null;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  onRecordUndo: (label: string, items: { id: string; status: OfferStatus }[]) => void;
}) {
  const ids = group.items.map((i) => i.id);
  const due = dueLabel(group.daysLeft);

  function snapshotItems(): { id: string; status: OfferStatus }[] {
    return group.items.map((i) => ({
      id: i.id,
      status: (i.status === "added" ? "added" : "available") as OfferStatus,
    }));
  }

  return (
    <View style={styles.offerBlock}>
      <View style={styles.offerHeader}>
        <View style={styles.flexShrink}>
          <Text style={styles.merchantName}>{group.merchant}</Text>
          <Text style={styles.offerDetails}>{group.details}</Text>
        </View>
        {group.maxCents ? (
          <Text style={[styles.offerValue, NUM_STYLE]}>{formatCents(group.maxCents)}</Text>
        ) : null}
      </View>

      <View style={styles.badgeWrap}>
        {group.rateLabel ? (
          <Badge label={group.rateLabel} tone={group.weak ? "neutral" : "green"} />
        ) : null}
        {due ? (
          <Badge
            label={due}
            tone={group.daysLeft !== null && group.daysLeft <= 7 ? "red" : "amber"}
          />
        ) : null}
      </View>

      <View style={styles.cardChipRow}>
        {group.items.map((item) => {
          const added = item.status === "added";
          const key = `offer.status:${item.id}`;
          return (
            <Pressable
              key={item.id}
              disabled={busyKey === key}
              onPress={() => {
                tapHaptic();
                void onAction(
                  {
                    type: "offers.setStatus",
                    id: item.id,
                    status: added ? "available" : "added",
                  },
                  key,
                );
              }}
              style={[styles.cardChip, added && styles.cardChipAdded]}
            >
              <CardSwatch style={item.cardStyle} />
              <Text
                style={[styles.cardChipLabel, added && styles.cardChipLabelAdded]}
                numberOfLines={1}
              >
                {added ? "✓ " : "+ "}
                {item.cardName}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actionRow}>
        <Button
          label="Used"
          size="sm"
          variant="secondary"
          loading={busyKey === `group:used:${group.key}`}
          onPress={() => {
            const snap = snapshotItems();
            void onAction(
              { type: "offers.setGroupStatus", ids, status: "used" },
              `group:used:${group.key}`,
            ).then(() => onRecordUndo(`Marked ${group.merchant} used`, snap));
          }}
        />
        <Button
          label="Skip"
          size="sm"
          variant="secondary"
          loading={busyKey === `group:skip:${group.key}`}
          onPress={() => {
            const snap = snapshotItems();
            void onAction(
              { type: "offers.setGroupStatus", ids, status: "dismissed" },
              `group:skip:${group.key}`,
            ).then(() => onRecordUndo(`Skipped ${group.merchant}`, snap));
          }}
        />
        <Button
          label="Hide merchant"
          size="sm"
          variant="ghost"
          loading={busyKey === `hide:${group.key}`}
          onPress={() =>
            void onAction(
              { type: "offers.hideMerchant", merchant: group.merchant },
              `hide:${group.key}`,
            )
          }
        />
      </View>
    </View>
  );
}

export function OffersScreen({
  data,
  refreshing,
  busyKey,
  onRefresh,
  onAction,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  busyKey: string | null;
  onRefresh: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
}) {
  const openCards = data.cards.filter((c) => !c.closed);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteCardId, setPasteCardId] = useState<string>(openCards[0]?.id ?? "");
  const [pasteText, setPasteText] = useState("");
  const [sortBy, setSortBy] = useState<OfferSortKey>("return");
  const [undoState, setUndoState] = useState<{
    label: string;
    items: { id: string; status: OfferStatus }[];
  } | null>(null);

  const sortedStrong = useMemo(
    () => sortOfferGroups(data.offers.strong, sortBy),
    [data.offers.strong, sortBy],
  );
  const sortedWeak = useMemo(
    () => sortOfferGroups(data.offers.weak, sortBy),
    [data.offers.weak, sortBy],
  );

  async function handleClipboardPaste() {
    const text = await Clipboard.getStringAsync();
    if (text.trim()) {
      setPasteText(text);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.flexShrink}>
          <Text style={styles.title}>Offers</Text>
          <Text style={[styles.subtitle, NUM_STYLE]}>
            {data.offers.strong.length} worth a look · {formatCents(data.offers.strongValueCents)}{" "}
            potential back
          </Text>
        </View>
        <Button
          label={showPaste ? "Close" : "Paste offers"}
          size="sm"
          variant={showPaste ? "secondary" : "primary"}
          onPress={() => setShowPaste((v) => !v)}
        />
      </View>

      {undoState ? (
        <SectionCard style={styles.undoBar}>
          <Text style={styles.undoText} numberOfLines={1}>
            {undoState.label}
          </Text>
          <View style={styles.rowGap}>
            <Button
              label="Undo"
              size="sm"
              variant="secondary"
              loading={busyKey === "offers.restore"}
              onPress={() =>
                void onAction(
                  { type: "offers.restore", items: undoState.items },
                  "offers.restore",
                ).then(() => setUndoState(null))
              }
            />
            <Button label="Dismiss" size="sm" variant="ghost" onPress={() => setUndoState(null)} />
          </View>
        </SectionCard>
      ) : null}

      {showPaste ? (
        <SectionCard style={styles.pastePanel}>
          <Text style={styles.smallLabel}>Which card are these offers from?</Text>
          <View style={styles.cardChipRow}>
            <Pressable
              onPress={() => setPasteCardId("")}
              style={[styles.cardChip, pasteCardId === "" && styles.cardChipSelected]}
            >
              <Text style={styles.cardChipLabel}>Any card</Text>
            </Pressable>
            {openCards.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setPasteCardId(c.id)}
                style={[styles.cardChip, pasteCardId === c.id && styles.cardChipSelected]}
              >
                <CardSwatch style={c.style} />
                <Text style={styles.cardChipLabel} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.rowGap}>
            <Button
              label="Paste from clipboard"
              size="sm"
              variant="secondary"
              onPress={() => void handleClipboardPaste()}
            />
          </View>

          <FieldInput
            label="Copied Amex / Chase offers page text"
            value={pasteText}
            onChangeText={setPasteText}
            multiline
            placeholder={"JetBlue\nSpend $250 or more, earn $50 back\nExpires 12/15/2026"}
          />

          <Button
            label="Save offers"
            loading={busyKey === "offers.paste"}
            disabled={!pasteText.trim()}
            onPress={() =>
              void onAction(
                {
                  type: "offers.paste",
                  cardId: pasteCardId || undefined,
                  text: pasteText,
                },
                "offers.paste",
              ).then(() => {
                setPasteText("");
                setShowPaste(false);
              })
            }
          />
        </SectionCard>
      ) : null}

      <View style={styles.sortRow}>
        {(
          [
            { key: "return", label: "Best return" },
            { key: "value", label: "Biggest reward" },
            { key: "expiry", label: "Expiring soonest" },
          ] as { key: OfferSortKey; label: string }[]
        ).map((pill) => {
          const active = sortBy === pill.key;
          return (
            <Pressable
              key={pill.key}
              onPress={() => {
                tapHaptic();
                setSortBy(pill.key);
              }}
              style={[styles.sortPill, active && styles.sortPillActive]}
            >
              <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sortedStrong.length === 0 ? (
        <SectionCard>
          <Text style={styles.noteText}>
            No strong offers saved right now. Copy your Amex or Chase offers page and tap Paste
            offers above.
          </Text>
        </SectionCard>
      ) : (
        <SectionCard style={styles.divideList}>
          {sortedStrong.map((g, idx) => (
            <View key={g.key} style={idx > 0 ? styles.rowDivider : undefined}>
              <OfferGroupCard
                group={g}
                busyKey={busyKey}
                onAction={onAction}
                onRecordUndo={(label, items) => setUndoState({ label, items })}
              />
            </View>
          ))}
        </SectionCard>
      )}

      {sortedWeak.length > 0 ? (
        <CollapsibleSection
          title={`Under ${Math.round(data.offers.weakRateThreshold * 100)}% back`}
          countLabel={`${sortedWeak.length}`}
        >
          {sortedWeak.map((g, idx) => (
            <View key={g.key} style={idx > 0 ? styles.rowDivider : undefined}>
              <OfferGroupCard
                group={g}
                busyKey={busyKey}
                onAction={onAction}
                onRecordUndo={(label, items) => setUndoState({ label, items })}
              />
            </View>
          ))}
        </CollapsibleSection>
      ) : null}

      {data.offers.cardChecks.length > 0 ? (
        <CollapsibleSection
          title="Last pasted by card"
          countLabel={`${data.offers.cardChecks.length}`}
        >
          {data.offers.cardChecks.map((check, idx) => (
            <View key={check.cardId} style={[styles.simpleRow, idx > 0 && styles.rowDivider]}>
              <View style={styles.rowIdentity}>
                <CardSwatch style={check.cardStyle} />
                <Text style={styles.simpleTitle} numberOfLines={1}>
                  {check.cardName}
                </Text>
              </View>
              <Badge
                label={check.checkedOn ? formatDate(check.checkedOn, data.today) : "Never pasted"}
                tone={check.stale ? "amber" : "green"}
              />
            </View>
          ))}
        </CollapsibleSection>
      ) : null}

      {data.offers.hiddenMerchants.length > 0 ? (
        <CollapsibleSection
          title="Hidden merchants"
          countLabel={`${data.offers.hiddenMerchants.length}`}
        >
          {data.offers.hiddenMerchants.map((h, idx) => (
            <View key={h.merchantKey} style={[styles.simpleRow, idx > 0 && styles.rowDivider]}>
              <Text style={styles.simpleTitle}>{h.label}</Text>
              <Button
                label="Show again"
                size="sm"
                variant="secondary"
                loading={busyKey === `unhide:${h.merchantKey}`}
                onPress={() =>
                  void onAction(
                    { type: "offers.unhideMerchant", merchantKey: h.merchantKey },
                    `unhide:${h.merchantKey}`,
                  )
                }
              />
            </View>
          ))}
        </CollapsibleSection>
      ) : null}

      {data.offers.past.length > 0 ? (
        <CollapsibleSection title="Used & skipped" countLabel={`${data.offers.past.length}`}>
          {data.offers.past.slice(0, 40).map((p, idx) => (
            <View key={p.id} style={[styles.simpleRow, idx > 0 && styles.rowDivider]}>
              <View style={styles.flexShrink}>
                <Text style={styles.simpleTitle}>{p.merchant}</Text>
                <Text style={styles.noteText} numberOfLines={1}>
                  {p.status === "used" ? "Used" : "Skipped"} · {p.details}
                </Text>
              </View>
              <Button
                label="Delete"
                size="sm"
                variant="ghost"
                loading={busyKey === `offer.del:${p.id}`}
                onPress={() =>
                  void onAction({ type: "offers.delete", id: p.id }, `offer.del:${p.id}`)
                }
              />
            </View>
          ))}
        </CollapsibleSection>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flexShrink: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 10,
  },
  undoText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink,
    flex: 1,
  },
  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pastePanel: {
    gap: 10,
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.muted,
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sortPill: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  sortPillActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
  },
  sortPillTextActive: {
    color: "#ffffff",
  },
  divideList: {
    paddingVertical: 6,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  offerBlock: {
    paddingVertical: 10,
    gap: 8,
  },
  offerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.ink,
  },
  offerDetails: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  offerValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cardChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
  },
  cardChipSelected: {
    borderColor: COLORS.ink,
    backgroundColor: COLORS.subtle,
  },
  cardChipAdded: {
    backgroundColor: COLORS.greenBg,
    borderColor: COLORS.greenBorder,
  },
  cardChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
    maxWidth: 175,
  },
  cardChipLabelAdded: {
    color: COLORS.greenInk,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  simpleRow: {
    minHeight: 44,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  simpleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
    flexShrink: 1,
  },
});

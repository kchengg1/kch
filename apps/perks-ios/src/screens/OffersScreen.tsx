import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Badge,
  Button,
  CardSwatch,
  CollapsibleSection,
  FieldInput,
  NUM_STYLE,
  SectionCard,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import {
  dueLabel,
  formatCents,
  formatDate,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_LABEL,
  sortOfferGroups,
} from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import { detectCardFromOffersText } from "../lib/offer-card-detect";
import type {
  MobileActionPayload,
  MobileBootstrap,
  MobileOfferGroup,
  OfferCategory,
  OfferSortKey,
  OfferStatus,
} from "../types";

const OfferGroupCard = React.memo(function OfferGroupCard({
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
  const styles = useThemedStyles(makeStyles);
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
        {group.category && group.category !== "other" ? (
          <Badge label={OFFER_CATEGORY_LABEL[group.category]} tone="neutral" />
        ) : null}
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
});

export const OffersScreen = React.memo(function OffersScreen({
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
  const styles = useThemedStyles(makeStyles);
  const listRef = useRef<FlatList<MobileOfferGroup>>(null);
  const openCards = useMemo(() => data.cards.filter((c) => !c.closed), [data.cards]);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteCardId, setPasteCardId] = useState<string>(openCards[0]?.id ?? "");
  const [autoDetectedName, setAutoDetectedName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [sortBy, setSortBy] = useState<OfferSortKey>("return");
  const [selectedCategory, setSelectedCategory] = useState<OfferCategory | null>(null);
  const [undoState, setUndoState] = useState<{
    label: string;
    items: { id: string; status: OfferStatus }[];
  } | null>(null);

  const selectedPasteCard = useMemo(
    () => openCards.find((c) => c.id === pasteCardId) ?? null,
    [openCards, pasteCardId],
  );

  const handleRecordUndo = useCallback(
    (label: string, items: { id: string; status: OfferStatus }[]) => {
      setUndoState({ label, items });
    },
    [],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<OfferCategory, number>();
    for (const g of data.offers.strong) {
      counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    }
    for (const g of data.offers.weak) {
      counts.set(g.category, (counts.get(g.category) ?? 0) + 1);
    }
    return counts;
  }, [data.offers.strong, data.offers.weak]);

  const visibleCategories = useMemo(
    () => OFFER_CATEGORIES.filter((c) => (categoryCounts.get(c.id) ?? 0) > 0),
    [categoryCounts],
  );
  const totalOfferCount = data.offers.strong.length + data.offers.weak.length;

  const sortedStrong = useMemo(() => {
    const list = selectedCategory
      ? data.offers.strong.filter((g) => g.category === selectedCategory)
      : data.offers.strong;
    return sortOfferGroups(list, sortBy);
  }, [data.offers.strong, selectedCategory, sortBy]);
  const sortedWeak = useMemo(() => {
    const list = selectedCategory
      ? data.offers.weak.filter((g) => g.category === selectedCategory)
      : data.offers.weak;
    return sortOfferGroups(list, sortBy);
  }, [data.offers.weak, selectedCategory, sortBy]);

  function handlePasteTextChange(nextText: string) {
    setPasteText(nextText);
    const detectedId = detectCardFromOffersText(nextText, openCards);
    if (detectedId) {
      setPasteCardId(detectedId);
      setAutoDetectedName(openCards.find((c) => c.id === detectedId)?.name ?? null);
    } else {
      setAutoDetectedName(null);
    }
  }

  async function handleClipboardPaste() {
    const text = await Clipboard.getStringAsync();
    if (text.trim()) {
      handlePasteTextChange(text);
    }
  }

  const hasFooter =
    sortedWeak.length > 0 ||
    data.offers.cardChecks.length > 0 ||
    data.offers.hiddenMerchants.length > 0 ||
    data.offers.past.length > 0;

  const keyExtractor = useCallback((item: MobileOfferGroup) => item.key, []);
  const strongLength = sortedStrong.length;
  const renderOfferItem = useCallback(
    ({ item: g, index }: { item: MobileOfferGroup; index: number }) => {
      const isFirst = index === 0;
      const isLast = index === strongLength - 1;
      return (
        <View
          style={[
            styles.offerListCell,
            isFirst && styles.offerListCellFirst,
            !isFirst && styles.rowDivider,
            isLast && styles.offerListCellLast,
          ]}
        >
          <OfferGroupCard
            group={g}
            busyKey={busyKey}
            onAction={onAction}
            onRecordUndo={handleRecordUndo}
          />
        </View>
      );
    },
    [busyKey, handleRecordUndo, onAction, strongLength, styles],
  );

  return (
    <FlatList
      ref={listRef}
      data={sortedStrong}
      keyExtractor={keyExtractor}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.sectionStack}>
          <View style={styles.headerRow}>
            <View style={styles.flexShrink}>
              <Text style={styles.title}>Offers</Text>
              <Text style={[styles.subtitle, NUM_STYLE]}>
                {data.offers.strong.length} worth a look ·{" "}
                {formatCents(data.offers.strongValueCents)} potential back
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
                <Button
                  label="Dismiss"
                  size="sm"
                  variant="ghost"
                  onPress={() => setUndoState(null)}
                />
              </View>
            </SectionCard>
          ) : null}

          {showPaste ? (
            <SectionCard style={styles.pastePanel}>
              <Text style={styles.smallLabel}>Which card are these offers from?</Text>
              <View style={styles.cardChipRow}>
                <Pressable
                  onPress={() => {
                    setPasteCardId("");
                    setAutoDetectedName(null);
                  }}
                  style={[styles.cardChip, pasteCardId === "" && styles.cardChipSelected]}
                >
                  <Text style={styles.cardChipLabel}>Any card</Text>
                </Pressable>
                {openCards.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setPasteCardId(c.id);
                      setAutoDetectedName(null);
                    }}
                    style={[styles.cardChip, pasteCardId === c.id && styles.cardChipSelected]}
                  >
                    <CardSwatch style={c.style} />
                    <Text style={styles.cardChipLabel} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {autoDetectedName ? (
                <Text style={styles.autoDetectedText}>
                  Auto-selected {autoDetectedName} from pasted text.
                </Text>
              ) : null}

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
                onChangeText={handlePasteTextChange}
                multiline
                placeholder={"JetBlue\nSpend $250 or more, earn $50 back\nExpires 12/15/2026"}
              />

              <Button
                label={
                  selectedPasteCard ? `Save offers to ${selectedPasteCard.name}` : "Save offers"
                }
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
                    setAutoDetectedName(null);
                    setShowPaste(false);
                  })
                }
              />

              {selectedPasteCard ? (
                <Button
                  label={`Mark ${selectedPasteCard.name} checked (no new offers)`}
                  variant="secondary"
                  loading={busyKey === "offers.markChecked"}
                  onPress={() =>
                    void onAction(
                      {
                        type: "offers.markChecked",
                        cardId: selectedPasteCard.id,
                      },
                      "offers.markChecked",
                    ).then(() => {
                      setPasteText("");
                      setAutoDetectedName(null);
                      setShowPaste(false);
                    })
                  }
                />
              ) : null}
            </SectionCard>
          ) : null}

          <View style={styles.sortRow}>
            {(
              [
                { key: "return", label: "Best return" },
                { key: "value", label: "Biggest reward" },
                { key: "expiry", label: "Expiring soonest" },
                { key: "category", label: "Category" },
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

          {visibleCategories.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              <Pressable
                onPress={() => {
                  tapHaptic();
                  setSelectedCategory(null);
                }}
                style={[styles.categoryPill, !selectedCategory && styles.categoryPillActive]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    !selectedCategory && styles.categoryPillTextActive,
                  ]}
                >
                  All ({totalOfferCount})
                </Text>
              </Pressable>
              {visibleCategories.map((cat) => {
                const active = selectedCategory === cat.id;
                const count = categoryCounts.get(cat.id) ?? 0;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      tapHaptic();
                      setSelectedCategory(active ? null : cat.id);
                    }}
                    style={[styles.categoryPill, active && styles.categoryPillActive]}
                  >
                    <Text
                      style={[styles.categoryPillText, active && styles.categoryPillTextActive]}
                    >
                      {cat.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {sortedStrong.length === 0 ? (
            <SectionCard>
              <Text style={styles.noteText}>
                {selectedCategory
                  ? `No strong ${OFFER_CATEGORY_LABEL[selectedCategory].toLowerCase()} offers right now.`
                  : "No strong offers saved right now. Copy your Amex or Chase offers page and tap Paste offers above."}
              </Text>
            </SectionCard>
          ) : null}
        </View>
      }
      renderItem={renderOfferItem}
      ListFooterComponent={
        hasFooter ? (
          <View style={styles.footerStack}>
            {sortedWeak.length > 0 ? (
              <CollapsibleSection
                title={`Under ${Math.round(data.offers.weakRateThreshold * 100)}% back`}
                countLabel={`${sortedWeak.length}`}
              >
                {() =>
                  sortedWeak.map((g, idx) => (
                    <View key={g.key} style={idx > 0 ? styles.rowDivider : undefined}>
                      <OfferGroupCard
                        group={g}
                        busyKey={busyKey}
                        onAction={onAction}
                        onRecordUndo={handleRecordUndo}
                      />
                    </View>
                  ))
                }
              </CollapsibleSection>
            ) : null}

            {data.offers.cardChecks.length > 0 ? (
              <CollapsibleSection
                title="Last pasted by card"
                countLabel={`${data.offers.cardChecks.length}`}
              >
                {() =>
                  data.offers.cardChecks.map((check, idx) => (
                    <Pressable
                      key={check.cardId}
                      accessibilityRole="button"
                      accessibilityLabel={`Paste offers for ${check.cardName}`}
                      onPress={() => {
                        tapHaptic();
                        setPasteCardId(check.cardId);
                        setShowPaste(true);
                        listRef.current?.scrollToOffset({ offset: 0, animated: true });
                      }}
                      style={({ pressed }) => [
                        styles.simpleRow,
                        idx > 0 && styles.rowDivider,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.rowIdentity}>
                        <CardSwatch style={check.cardStyle} />
                        <Text style={styles.simpleTitle} numberOfLines={1}>
                          {check.cardName}
                        </Text>
                      </View>
                      <View style={styles.rowGap}>
                        <Badge
                          label={
                            check.checkedOn
                              ? formatDate(check.checkedOn, data.today)
                              : "Never pasted"
                          }
                          tone={check.stale ? "amber" : "green"}
                        />
                        <Text style={styles.rowChevron}>›</Text>
                      </View>
                    </Pressable>
                  ))
                }
              </CollapsibleSection>
            ) : null}

            {data.offers.hiddenMerchants.length > 0 ? (
              <CollapsibleSection
                title="Hidden merchants"
                countLabel={`${data.offers.hiddenMerchants.length}`}
              >
                {() =>
                  data.offers.hiddenMerchants.map((h, idx) => (
                    <View
                      key={h.merchantKey}
                      style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
                    >
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
                  ))
                }
              </CollapsibleSection>
            ) : null}

            {data.offers.past.length > 0 ? (
              <CollapsibleSection title="Used & skipped" countLabel={`${data.offers.past.length}`}>
                {() =>
                  data.offers.past.slice(0, 40).map((p, idx) => (
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
                  ))
                }
              </CollapsibleSection>
            ) : null}
          </View>
        ) : undefined
      }
    />
  );
});

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
    },
    sectionStack: {
      gap: 14,
    },
    footerStack: {
      marginTop: 14,
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
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    sortPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.ink,
    },
    sortPillTextActive: {
      color: COLORS.primaryInk,
    },
    categoryScroll: {
      gap: 6,
      paddingRight: 8,
    },
    categoryPill: {
      minHeight: 32,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      justifyContent: "center",
    },
    categoryPillActive: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.subtle,
    },
    categoryPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.muted,
    },
    categoryPillTextActive: {
      color: COLORS.primary,
    },
    offerListCell: {
      backgroundColor: COLORS.card,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 14,
    },
    offerListCellFirst: {
      marginTop: 14,
      borderTopWidth: 1,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingTop: 6,
    },
    offerListCellLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      paddingBottom: 6,
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
    autoDetectedText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.greenInk,
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
    rowPressed: {
      opacity: 0.7,
    },
    rowChevron: {
      fontSize: 18,
      fontWeight: "600",
      color: COLORS.muted,
    },
  });

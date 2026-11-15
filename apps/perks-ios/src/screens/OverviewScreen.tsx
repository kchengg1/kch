import React, { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Badge,
  Button,
  CardSwatch,
  CollapsibleSection,
  COLORS,
  Meter,
  NUM_STYLE,
  SectionCard,
} from "../components/ui";
import { CATEGORIES, classify, rankCards } from "../lib/earn";
import {
  centsToInputDollars,
  dueLabel,
  formatCents,
  formatCpp,
  formatDate,
  formatSignedCents,
} from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type { BenefitStatus, MobileActionPayload, MobileBootstrap, TabKey } from "../types";

function CreditActionRow({
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
  const [showPartial, setShowPartial] = useState(false);
  const [partialText, setPartialText] = useState(
    item.usedCents > 0 ? centsToInputDollars(item.usedCents) : "",
  );
  const periodKey = item.period?.key ?? "";
  const actionKey = `${item.benefit.id}:${periodKey}`;
  const isUrgent = item.daysLeft !== null && item.daysLeft <= 7;
  const due = dueLabel(item.daysLeft);

  return (
    <View style={styles.creditRow}>
      <View style={styles.creditMain}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tapHaptic();
            onOpenCard(item.card.id);
          }}
          style={styles.creditTitleBlock}
        >
          <CardSwatch style={item.cardStyle} />
          <View style={styles.flexShrink}>
            <Text style={styles.itemTitle}>{item.benefit.name}</Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.card.name}
              {item.period ? ` · ${item.period.label}` : ""}
            </Text>
          </View>
        </Pressable>
        {item.benefit.amountCents > 0 ? (
          <Text style={[styles.creditAmount, NUM_STYLE]}>{formatCents(item.remainingCents)}</Text>
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        {due ? <Badge label={due} tone={isUrgent ? "red" : "amber"} /> : null}
        {item.usedCents > 0 && item.benefit.amountCents > 0 ? (
          <Badge label={`${formatCents(item.usedCents)} logged`} tone="neutral" />
        ) : null}
        {item.benefit.enrollRequired && !item.benefit.enrolled ? (
          <Badge label="Needs enrollment" tone="amber" />
        ) : null}
      </View>

      {item.benefit.notes ? <Text style={styles.noteText}>{item.benefit.notes}</Text> : null}

      {periodKey ? (
        <View style={styles.actionRow}>
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
          {item.benefit.amountCents > 0 ? (
            <Button
              label={showPartial ? "Cancel" : "Log part"}
              size="sm"
              variant="secondary"
              onPress={() => setShowPartial((v) => !v)}
            />
          ) : null}
        </View>
      ) : null}

      {showPartial && periodKey ? (
        <View style={styles.inlineEditor}>
          <TextInput
            value={partialText}
            onChangeText={setPartialText}
            placeholder="Used so far ($)"
            placeholderTextColor={COLORS.faint}
            keyboardType="decimal-pad"
            style={styles.inlineInput}
          />
          <Button
            label="Save"
            size="sm"
            loading={busyKey === `${actionKey}:part`}
            onPress={() =>
              void onAction(
                {
                  type: "usage.logAmount",
                  benefitId: item.benefit.id,
                  periodKey,
                  amount: partialText || "0",
                },
                `${actionKey}:part`,
              ).then(() => setShowPartial(false))
            }
          />
        </View>
      ) : null}
    </View>
  );
}

export function OverviewScreen({
  data,
  refreshing,
  busyKey,
  onRefresh,
  onAction,
  onOpenCard,
  onOpenCatchUp,
  onOpenSettings,
  onNavigateTab,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  busyKey: string | null;
  onRefresh: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
  onOpenCatchUp: () => void;
  onOpenSettings: () => void;
  onNavigateTab: (tab: TabKey) => void;
}) {
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});
  const [editingBonusCardId, setEditingBonusCardId] = useState<string | null>(null);
  const [pickQuery, setPickQuery] = useState("");

  const year = data.today.slice(0, 4);
  const openCards = data.cards.filter((c) => !c.closed);
  const firstName = data.user.name.trim().split(/\s+/)[0] || "there";

  const trimmedPick = pickQuery.trim();
  const valueByProgram = new Map(data.points.programs.map((p) => [p.program, p.centsPerPoint]));
  const pickTarget = trimmedPick ? classify(trimmedPick) : null;
  const pickResults = pickTarget
    ? rankCards(openCards, pickTarget, (program) => valueByProgram.get(program) ?? 1)
    : [];
  const cardById = new Map(openCards.map((c) => [c.id, c]));
  const matchingOffers =
    trimmedPick.length >= 3
      ? [...data.offers.strong, ...data.offers.weak].filter((g) =>
          g.merchant.toLowerCase().includes(trimmedPick.toLowerCase()),
        )
      : [];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topHeader}>
        <View style={styles.flexShrink}>
          <Text style={styles.screenTitle}>Hi, {firstName}</Text>
          <Text style={styles.screenSub}>{formatDate(data.today)}</Text>
        </View>
        <View style={styles.headerButtons}>
          <Button label="Catch up" size="sm" variant="secondary" onPress={onOpenCatchUp} />
          <Button label="Settings" size="sm" variant="secondary" onPress={onOpenSettings} />
        </View>
      </View>

      <View style={styles.statGrid}>
        <SectionCard style={styles.statTile}>
          <Text style={styles.statLabel}>Expiring this month</Text>
          <Text style={[styles.statValue, NUM_STYLE]}>
            {formatCents(data.overview.expiringThisMonthCents)}
          </Text>
          <Text style={styles.statFoot}>
            {data.overview.expiringThisMonthCount === 0
              ? "All clear"
              : `${data.overview.expiringThisMonthCount} left`}
          </Text>
        </SectionCard>

        <SectionCard style={styles.statTile}>
          <Text style={styles.statLabel}>Used in {year}</Text>
          <Text style={[styles.statValue, NUM_STYLE]}>
            {formatCents(data.overview.capturedCents)}
          </Text>
          <Text style={[styles.statFoot, NUM_STYLE]}>
            of {formatCents(data.overview.availableCents)}
          </Text>
        </SectionCard>

        <SectionCard style={styles.statTile}>
          <Text style={styles.statLabel}>Annual fees</Text>
          <Text style={[styles.statValue, NUM_STYLE]}>
            {formatCents(data.overview.annualFeesCents)}
          </Text>
          <Text style={styles.statFoot}>{openCards.length} open cards</Text>
        </SectionCard>
      </View>

      {openCards.length > 0 ? (
        <SectionCard style={styles.pickerCard}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeading}>Which card?</Text>
            {trimmedPick ? (
              <Pressable onPress={() => setPickQuery("")}>
                <Text style={styles.linkText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput
            value={pickQuery}
            onChangeText={setPickQuery}
            placeholder="Whole Foods, Hyatt, dining, gas..."
            placeholderTextColor={COLORS.faint}
            style={styles.inlineInput}
          />
          <View style={styles.quickCats}>
            {CATEGORIES.slice(0, 6).map((c) => {
              const active = trimmedPick.toLowerCase() === c.label.toLowerCase();
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    tapHaptic();
                    setPickQuery(active ? "" : c.label);
                  }}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {trimmedPick && pickResults.length > 0 ? (
            <View style={styles.pickList}>
              {matchingOffers.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => onNavigateTab("offers")}
                  style={styles.offerBanner}
                >
                  <Text style={styles.offerBannerText}>
                    Saved offer at {o.merchant}: {o.details}
                  </Text>
                </Pressable>
              ))}
              {pickResults.slice(0, 4).map((p, idx) => {
                const c = cardById.get(p.cardId);
                return (
                  <Pressable
                    key={p.cardId}
                    onPress={() => onOpenCard(p.cardId)}
                    style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
                  >
                    <View style={styles.creditTitleBlock}>
                      {c ? <CardSwatch style={c.style} /> : null}
                      <View style={styles.flexShrink}>
                        <Text style={styles.itemTitle}>{p.cardName}</Text>
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {Number(p.x.toFixed(1))}x {p.currency}
                          {p.currency !== "Cash back" ? ` (${formatCpp(p.centsPerPoint)})` : ""}
                          {p.note ? ` · ${p.note}` : ""}
                        </Text>
                      </View>
                    </View>
                    <Badge label={`~${p.returnPct}%`} tone={idx === 0 ? "green" : "neutral"} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard style={styles.emptyCard}>
          <Text style={styles.sectionHeading}>Add your first card</Text>
          <Text style={styles.noteText}>
            Pick from built-in card templates or paste your spreadsheet to track monthly and yearly
            credits automatically.
          </Text>
          <Button label="Go to Cards" onPress={() => onNavigateTab("cards")} />
        </SectionCard>
      )}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Use these next</Text>
        {data.overview.soon.length === 0 ? (
          <SectionCard>
            <Text style={styles.noteText}>Nothing expiring in the next 45 days.</Text>
          </SectionCard>
        ) : (
          <SectionCard style={styles.divideList}>
            {data.overview.soon.map((item, idx) => (
              <View
                key={`${item.benefit.id}:${item.period?.key ?? idx}`}
                style={idx > 0 ? styles.rowDivider : undefined}
              >
                <CreditActionRow
                  item={item}
                  busyKey={busyKey}
                  onAction={onAction}
                  onOpenCard={onOpenCard}
                />
              </View>
            ))}
          </SectionCard>
        )}

        {data.overview.later.length > 0 ? (
          <CollapsibleSection title="Later this year" countLabel={`${data.overview.later.length}`}>
            <View style={styles.laterStack}>
              {data.overview.later.map((item, idx) => (
                <View
                  key={`${item.benefit.id}:${item.period?.key ?? idx}`}
                  style={idx > 0 ? styles.rowDivider : undefined}
                >
                  <CreditActionRow
                    item={item}
                    busyKey={busyKey}
                    onAction={onAction}
                    onOpenCard={onOpenCard}
                  />
                </View>
              ))}
            </View>
          </CollapsibleSection>
        ) : null}
      </View>

      {data.overview.activeBonuses.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Sign-up bonuses in progress</Text>
          {data.overview.activeBonuses.map((b) => {
            const editing = editingBonusCardId === b.cardId;
            const draft = spentDrafts[b.cardId] ?? centsToInputDollars(b.msr.spentCents);
            return (
              <SectionCard key={b.cardId} style={styles.bonusCard}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenCard(b.cardId)}
                  style={styles.creditTitleBlock}
                >
                  <CardSwatch style={b.cardStyle} />
                  <View style={styles.flexShrink}>
                    <Text style={styles.itemTitle}>{b.cardName}</Text>
                    {b.bonusText ? <Text style={styles.itemMeta}>{b.bonusText}</Text> : null}
                  </View>
                </Pressable>

                <Meter
                  value={b.msr.spentCents}
                  max={b.msr.requiredCents}
                  tone={b.msr.state === "met" ? "green" : "dark"}
                />

                <View style={styles.bonusMetaRow}>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    {formatCents(b.msr.spentCents)} of {formatCents(b.msr.requiredCents)}
                  </Text>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    {b.msr.state === "met"
                      ? "Spend met"
                      : `${formatCents(b.msr.leftCents)} left${
                          b.msr.daysLeft !== null ? ` · ${dueLabel(b.msr.daysLeft)}` : ""
                        }`}
                  </Text>
                </View>

                {b.msr.perDayCents ? (
                  <Text style={[styles.noteText, NUM_STYLE]}>
                    About {formatCents(b.msr.perDayCents)}/day to finish on time.
                  </Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Button
                    label={editing ? "Cancel" : "Update spend"}
                    size="sm"
                    variant="secondary"
                    onPress={() => setEditingBonusCardId(editing ? null : b.cardId)}
                  />
                  {b.msr.state === "met" ? (
                    <Button
                      label="Bonus posted"
                      size="sm"
                      loading={busyKey === `bonus.received:${b.cardId}`}
                      onPress={() =>
                        void onAction(
                          { type: "bonus.markReceived", cardId: b.cardId },
                          `bonus.received:${b.cardId}`,
                        )
                      }
                    />
                  ) : null}
                </View>

                {editing ? (
                  <View style={styles.inlineEditor}>
                    <TextInput
                      value={draft}
                      onChangeText={(v) => setSpentDrafts((prev) => ({ ...prev, [b.cardId]: v }))}
                      placeholder="Spent so far ($)"
                      placeholderTextColor={COLORS.faint}
                      keyboardType="decimal-pad"
                      style={styles.inlineInput}
                    />
                    <Button
                      label="Save"
                      size="sm"
                      loading={busyKey === `bonus.spent:${b.cardId}`}
                      onPress={() =>
                        void onAction(
                          {
                            type: "bonus.setSpent",
                            cardId: b.cardId,
                            spent: draft || "0",
                          },
                          `bonus.spent:${b.cardId}`,
                        ).then(() => setEditingBonusCardId(null))
                      }
                    />
                  </View>
                ) : null}
              </SectionCard>
            );
          })}
        </View>
      ) : null}

      {data.overview.expiringOffers.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeading}>Offers expiring soon</Text>
            <Pressable onPress={() => onNavigateTab("offers")}>
              <Text style={styles.linkText}>See all</Text>
            </Pressable>
          </View>
          <SectionCard style={styles.divideList}>
            {data.overview.expiringOffers.map((offer, idx) => (
              <Pressable
                key={offer.key}
                onPress={() => onNavigateTab("offers")}
                style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
              >
                <View style={styles.flexShrink}>
                  <Text style={styles.itemTitle}>{offer.merchant}</Text>
                  <Text style={styles.itemMeta} numberOfLines={2}>
                    {offer.details}
                  </Text>
                </View>
                <Badge label={dueLabel(offer.daysLeft)} tone="amber" />
              </Pressable>
            ))}
          </SectionCard>
        </View>
      ) : null}

      {data.overview.feesDue.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Annual fees coming up</Text>
          <SectionCard style={styles.divideList}>
            {data.overview.feesDue.map((fee, idx) => (
              <Pressable
                key={fee.cardId}
                onPress={() => onOpenCard(fee.cardId)}
                style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
              >
                <View style={styles.creditTitleBlock}>
                  <CardSwatch style={fee.cardStyle} />
                  <View style={styles.flexShrink}>
                    <Text style={styles.itemTitle}>{fee.cardName}</Text>
                    <Text style={[styles.itemMeta, NUM_STYLE]}>
                      {formatCents(fee.annualFeeCents)} around{" "}
                      {formatDate(fee.nextFeeOn, data.today)}
                    </Text>
                  </View>
                </View>
                <Badge
                  label={`${formatSignedCents(fee.netCents)}/yr`}
                  tone={fee.netCents >= 0 ? "green" : "red"}
                />
              </Pressable>
            ))}
          </SectionCard>
        </View>
      ) : null}

      {openCards.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionHeading}>By card</Text>
            <Pressable onPress={() => onNavigateTab("cards")}>
              <Text style={styles.linkText}>Manage</Text>
            </Pressable>
          </View>
          <SectionCard style={styles.divideList}>
            {openCards.map((card, idx) => (
              <Pressable
                key={card.id}
                accessibilityRole="button"
                onPress={() => {
                  tapHaptic();
                  onOpenCard(card.id);
                }}
                style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
              >
                <View style={styles.creditTitleBlock}>
                  <CardSwatch style={card.style} />
                  <View style={styles.flexShrink}>
                    <Text style={styles.itemTitle}>{card.name}</Text>
                    <Text style={[styles.itemMeta, NUM_STYLE]}>
                      {card.annualFeeCents > 0
                        ? `${formatCents(card.annualFeeCents)}/yr`
                        : "No annual fee"}
                    </Text>
                  </View>
                </View>
                <View style={styles.rightNumbers}>
                  <Text style={[styles.itemTitle, NUM_STYLE]}>
                    {formatCents(card.capturedCents)}
                  </Text>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    of {formatCents(card.availableCents)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </SectionCard>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 18,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  screenSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statTile: {
    flex: 1,
    padding: 11,
    gap: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.muted,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.ink,
  },
  statFoot: {
    fontSize: 11,
    color: COLORS.muted,
  },
  emptyCard: {
    gap: 10,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  divideList: {
    paddingVertical: 6,
  },
  laterStack: {
    gap: 4,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  creditRow: {
    paddingVertical: 10,
    gap: 8,
  },
  creditMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  creditTitleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  flexShrink: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.ink,
  },
  itemMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 1,
  },
  creditAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  inlineEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.bg,
  },
  bonusCard: {
    gap: 10,
  },
  bonusMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  simpleRow: {
    minHeight: 52,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rightNumbers: {
    alignItems: "flex-end",
  },
  pickerCard: {
    gap: 8,
  },
  quickCats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  catChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  catChipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
  },
  catChipTextActive: {
    color: "#ffffff",
  },
  pickList: {
    marginTop: 4,
    gap: 4,
  },
  offerBanner: {
    backgroundColor: COLORS.greenBg,
    borderColor: COLORS.greenBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  offerBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.greenInk,
  },
});

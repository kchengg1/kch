import React, { useMemo, useState } from "react";
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
  Meter,
  NUM_STYLE,
  SectionCard,
  useTheme,
  useThemedStyles,
  type ThemeColors,
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

const CreditActionRow = React.memo(function CreditActionRow({
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [showPartial, setShowPartial] = useState(false);
  const [partialText, setPartialText] = useState(
    item.usedCents > 0 ? centsToInputDollars(item.usedCents) : "",
  );
  const periodKey = item.period?.key ?? "";
  const actionKey = `${item.benefit.id}:${periodKey}`;
  const isUrgent = item.daysLeft !== null && item.daysLeft <= 7;
  const isSoon = !isUrgent && item.daysLeft !== null && item.daysLeft <= 31;
  const due = dueLabel(item.daysLeft);

  return (
    <View
      style={[
        styles.creditRow,
        isUrgent ? styles.creditRowUrgent : isSoon ? styles.creditRowSoon : styles.creditRowNormal,
      ]}
    >
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
          <View style={[styles.amountPill, isUrgent && styles.amountPillUrgent]}>
            <Text style={[styles.creditAmount, isUrgent && styles.creditAmountUrgent, NUM_STYLE]}>
              {formatCents(item.remainingCents)}
            </Text>
          </View>
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
            placeholderTextColor={colors.faint}
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
});

export const OverviewScreen = React.memo(function OverviewScreen({
  data,
  refreshing,
  busyKey,
  onRefresh,
  onAction,
  onOpenCard,
  onOpenCatchUp,
  onOpenSettings,
  onOpenYearEnd,
  onOpenReferrals,
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
  onOpenYearEnd: () => void;
  onOpenReferrals: (templateKey?: string) => void;
  onNavigateTab: (tab: TabKey) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [spentDrafts, setSpentDrafts] = useState<Record<string, string>>({});
  const [editingBonusCardId, setEditingBonusCardId] = useState<string | null>(null);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, string>>({});
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [showAllFees, setShowAllFees] = useState(false);

  const year = data.today.slice(0, 4);
  const openCards = useMemo(() => data.cards.filter((c) => !c.closed), [data.cards]);
  const firstName = data.user.name.trim().split(/\s+/)[0] || "there";
  const capturePct =
    data.overview.availableCents > 0
      ? Math.min(
          100,
          Math.round((data.overview.capturedCents / data.overview.availableCents) * 100),
        )
      : 0;
  const fees = data.overview.annualFeesCents;
  const captured = data.overview.capturedCents;
  const breakEven = data.overview.breakEven;
  const heroFeeMarkerPct =
    data.overview.availableCents > 0 && fees > 0 && fees <= data.overview.availableCents
      ? Math.min(99, Math.max(1, Math.round((fees / data.overview.availableCents) * 100)))
      : null;

  const trimmedPick = pickQuery.trim();
  const valueByProgram = useMemo(
    () => new Map(data.points.programs.map((p) => [p.program, p.centsPerPoint])),
    [data.points.programs],
  );
  const pickTarget = useMemo(() => (trimmedPick ? classify(trimmedPick) : null), [trimmedPick]);
  const pickResults = useMemo(
    () =>
      pickTarget
        ? rankCards(openCards, pickTarget, (program) => valueByProgram.get(program) ?? 1)
        : [],
    [openCards, pickTarget, valueByProgram],
  );
  const cardById = useMemo(() => new Map(openCards.map((c) => [c.id, c])), [openCards]);
  const matchingOffers = useMemo(
    () =>
      trimmedPick.length >= 3
        ? [...data.offers.strong, ...data.offers.weak].filter((g) =>
            g.merchant.toLowerCase().includes(trimmedPick.toLowerCase()),
          )
        : [],
    [data.offers.strong, data.offers.weak, trimmedPick],
  );

  const shareablePreview = data.referrals.shareableCards
    .slice(0, 2)
    .map((c) => c.name)
    .join(" and ");

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>P</Text>
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.screenTitle}>Hi, {firstName}</Text>
            <Text style={styles.screenSub}>{formatDate(data.today)}</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <Button label="Catch up" size="sm" variant="secondary" onPress={onOpenCatchUp} />
          <Button label="Settings" size="sm" variant="secondary" onPress={onOpenSettings} />
        </View>
      </View>

      {/* Sapphire Concierge Portfolio Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.heroEyebrow}>{year} CAPTURED</Text>
            <View style={styles.heroValueRow}>
              <Text style={[styles.heroValue, NUM_STYLE]}>{formatCents(captured)}</Text>
              {data.overview.availableCents > 0 ? (
                <View style={styles.heroPctPill}>
                  <Text style={[styles.heroPctText, NUM_STYLE]}>{capturePct}%</Text>
                </View>
              ) : null}
            </View>
            {breakEven ? (
              <View
                style={[
                  styles.heroBreakEvenPill,
                  breakEven.state === "covered" && styles.heroBreakEvenCovered,
                  breakEven.state === "behind" && styles.heroBreakEvenBehind,
                ]}
              >
                <Text
                  style={[
                    styles.heroBreakEvenText,
                    NUM_STYLE,
                    breakEven.state === "covered" && styles.heroBreakEvenCoveredText,
                    breakEven.state === "behind" && styles.heroBreakEvenBehindText,
                  ]}
                >
                  {breakEven.pct}% of fees ·{" "}
                  {breakEven.state === "covered"
                    ? "Covered"
                    : breakEven.state === "on-pace"
                      ? "On pace"
                      : "Behind pace"}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroPillLabel}>Expiring soon</Text>
            <Text style={[styles.heroPillGold, NUM_STYLE]}>
              {formatCents(data.overview.expiringThisMonthCents)}
            </Text>
            <Text style={styles.heroPillSub}>
              {data.overview.expiringThisMonthCount === 0
                ? "All clear"
                : `${data.overview.expiringThisMonthCount} left`}
            </Text>
          </View>
        </View>

        {data.overview.availableCents > 0 ? (
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${capturePct}%` }]} />
            {heroFeeMarkerPct !== null ? (
              <View
                pointerEvents="none"
                style={[styles.heroMarker, { left: `${heroFeeMarkerPct}%` }]}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.heroFootRow}>
          <Text style={[styles.heroFootText, NUM_STYLE]} numberOfLines={1}>
            of {formatCents(data.overview.availableCents)} tracked
          </Text>
          <Text style={[styles.heroFootText, NUM_STYLE]} numberOfLines={1}>
            {fees > 0
              ? captured >= fees
                ? `+${formatCents(captured - fees)} vs ${formatCents(fees)} fees`
                : `${formatCents(fees - captured)} to cover ${formatCents(fees)} fees`
              : `${openCards.length} open cards`}
          </Text>
        </View>

        {data.points.totalValueCents > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tapHaptic();
              onNavigateTab("points");
            }}
            style={styles.heroPointsRow}
          >
            <Text style={styles.heroPointsLabel}>Points stash</Text>
            <Text style={[styles.heroPointsValue, NUM_STYLE]}>
              {formatCents(data.points.totalValueCents)} →
            </Text>
          </Pressable>
        ) : null}
      </View>

      {data.yearEnd.inWindow ? (
        <SectionCard style={styles.calloutAmber}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.calloutAmberTitle}>Year-end checklist</Text>
            <Badge
              label={
                data.yearEnd.daysLeft === 0
                  ? "Dec 31 today"
                  : `${data.yearEnd.daysLeft}d until Dec 31`
              }
              tone="amber"
            />
          </View>
          <Text style={styles.calloutAmberBody}>
            {data.yearEnd.expiringCount > 0
              ? `${formatCents(data.yearEnd.expiringCents)} across ${data.yearEnd.expiringCount} credit${data.yearEnd.expiringCount === 1 ? "" : "s"} resets on Jan 1 — plus annual caps, spend goals, and Dec vs Jan card timing.`
              : "All calendar-year credits logged! Check annual spend caps, referral resets, and Dec vs Jan timing."}
          </Text>
          <View style={styles.actionRow}>
            <Button label="Open year-end checklist" size="sm" onPress={onOpenYearEnd} />
          </View>
        </SectionCard>
      ) : null}

      {data.overview.catalogUpdateCards.length > 0 ? (
        <SectionCard style={styles.calloutAmber}>
          <Text style={styles.calloutAmberTitle}>Built-in card benefits updated</Text>
          <Text style={styles.calloutAmberBody}>
            Our card catalog has newer credits or terms for{" "}
            {data.overview.catalogUpdateCards.length === 1
              ? "one of your cards"
              : `${data.overview.catalogUpdateCards.length} of your cards`}
            . Your logged history stays intact.
          </Text>
          {data.overview.catalogUpdateCards.map((u, idx) => (
            <View
              key={u.cardId}
              style={[styles.catalogUpdateRow, idx > 0 && styles.calloutDivider]}
            >
              <Pressable onPress={() => onOpenCard(u.cardId)} style={styles.creditTitleBlock}>
                <CardSwatch style={u.cardStyle} />
                <View style={styles.flexShrink}>
                  <Text style={styles.itemTitle}>{u.cardName}</Text>
                  <Text style={styles.itemMeta} numberOfLines={2}>
                    {u.summary.join(" · ")}
                  </Text>
                </View>
              </Pressable>
              <Button
                label="Apply"
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

      {data.referrals.mine.length === 0 && data.referrals.shareableCards.length > 0 ? (
        <SectionCard style={styles.referralCallout}>
          <Text style={styles.sectionHeading}>Share your referral links</Text>
          <Text style={styles.noteText}>
            You hold {shareablePreview}
            {data.referrals.shareableCards.length > 2
              ? ` and ${data.referrals.shareableCards.length - 2} more`
              : ""}
            . Drop your referral links in so friends in the group use yours when applying.
          </Text>
          <View style={styles.actionRow}>
            <Button
              label="Share a referral link"
              size="sm"
              variant="secondary"
              onPress={() => onOpenReferrals(data.referrals.shareableCards[0]?.templateKey)}
            />
          </View>
        </SectionCard>
      ) : null}

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
            placeholderTextColor={colors.faint}
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
            {() => (
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
            )}
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
                      placeholderTextColor={colors.faint}
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

      {data.overview.spendTargets.length > 0 || data.overview.untrackedSpendTargets.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Spending goals for {year}</Text>
          {data.overview.spendTargets.map((t) => {
            const editing = editingTargetId === t.id;
            const draft = targetDrafts[t.id] ?? centsToInputDollars(t.spentCents);
            const leftCents = Math.max(0, t.targetCents - t.spentCents);
            const met = t.spentCents >= t.targetCents;
            return (
              <SectionCard key={t.id} style={styles.bonusCard}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenCard(t.cardId)}
                  style={styles.creditTitleBlock}
                >
                  <CardSwatch style={t.cardStyle} />
                  <View style={styles.flexShrink}>
                    <Text style={styles.itemTitle}>{t.name}</Text>
                    <Text style={styles.itemMeta}>
                      {t.cardName} · {t.reward}
                    </Text>
                  </View>
                </Pressable>

                <Meter value={t.spentCents} max={t.targetCents} tone={met ? "green" : "dark"} />

                <View style={styles.bonusMetaRow}>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    {formatCents(t.spentCents)} of {formatCents(t.targetCents)}
                  </Text>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    {met ? "Goal met ✓" : `${formatCents(leftCents)} to go`}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <Button
                    label={editing ? "Cancel" : "Update spend"}
                    size="sm"
                    variant="secondary"
                    onPress={() => setEditingTargetId(editing ? null : t.id)}
                  />
                  <Button
                    label="Not chasing"
                    size="sm"
                    variant="ghost"
                    loading={busyKey === `target.track:${t.id}`}
                    onPress={() =>
                      void onAction(
                        { type: "spendTarget.setTracked", id: t.id, tracked: false },
                        `target.track:${t.id}`,
                      )
                    }
                  />
                </View>

                {editing ? (
                  <View style={styles.inlineEditor}>
                    <TextInput
                      value={draft}
                      onChangeText={(v) => setTargetDrafts((prev) => ({ ...prev, [t.id]: v }))}
                      placeholder="Spent in calendar year ($)"
                      placeholderTextColor={colors.faint}
                      keyboardType="decimal-pad"
                      style={styles.inlineInput}
                    />
                    <Button
                      label="Save"
                      size="sm"
                      loading={busyKey === `target.spent:${t.id}`}
                      onPress={() =>
                        void onAction(
                          {
                            type: "spendTarget.setSpent",
                            id: t.id,
                            spent: draft || "0",
                          },
                          `target.spent:${t.id}`,
                        ).then(() => setEditingTargetId(null))
                      }
                    />
                  </View>
                ) : null}
              </SectionCard>
            );
          })}

          {data.overview.untrackedSpendTargets.length > 0 ? (
            <CollapsibleSection
              title="Paused spend goals"
              countLabel={`${data.overview.untrackedSpendTargets.length}`}
            >
              {() => (
                <View style={styles.laterStack}>
                  {data.overview.untrackedSpendTargets.map((t, idx) => (
                    <View key={t.id} style={[styles.simpleRow, idx > 0 && styles.rowDivider]}>
                      <View style={styles.creditTitleBlock}>
                        <CardSwatch style={t.cardStyle} />
                        <View style={styles.flexShrink}>
                          <Text style={styles.itemTitle}>{t.name}</Text>
                          <Text style={[styles.itemMeta, NUM_STYLE]}>
                            {t.cardName} · {formatCents(t.targetCents)}/yr · {t.reward}
                          </Text>
                        </View>
                      </View>
                      <Button
                        label="Track"
                        size="sm"
                        variant="secondary"
                        loading={busyKey === `target.track:${t.id}`}
                        onPress={() =>
                          void onAction(
                            { type: "spendTarget.setTracked", id: t.id, tracked: true },
                            `target.track:${t.id}`,
                          )
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </CollapsibleSection>
          ) : null}
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

      {data.overview.feesDue.length > 0
        ? (() => {
            const soonFeeCount = data.overview.feesDue.filter(
              (f) => f.daysUntilFee !== null && f.daysUntilFee <= 60,
            ).length;
            const initialFeeCount =
              soonFeeCount === 1 ? 1 : Math.min(2, data.overview.feesDue.length);
            const visibleFees = showAllFees
              ? data.overview.feesDue
              : data.overview.feesDue.slice(0, initialFeeCount);
            const hiddenFeeCount = Math.max(0, data.overview.feesDue.length - initialFeeCount);

            return (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionHeading}>Annual fees coming up</Text>
                  {data.overview.feesDue.length > 1 ? (
                    <Text style={styles.sectionMeta}>{data.overview.feesDue.length} cards</Text>
                  ) : null}
                </View>
                <SectionCard style={styles.divideList}>
                  {visibleFees.map((fee, idx) => (
                    <Pressable
                      key={fee.cardId}
                      accessibilityRole="button"
                      onPress={() => {
                        tapHaptic();
                        onOpenCard(fee.cardId);
                      }}
                      style={[styles.simpleRow, idx > 0 && styles.rowDivider]}
                    >
                      <View style={styles.creditTitleBlock}>
                        <CardSwatch style={fee.cardStyle} />
                        <View style={styles.flexShrink}>
                          <Text style={styles.itemTitle}>{fee.cardName}</Text>
                          <Text style={[styles.itemMeta, NUM_STYLE]}>
                            {fee.nextFeeOn
                              ? `${formatCents(fee.annualFeeCents)} around ${formatDate(fee.nextFeeOn, data.today)}`
                              : `${formatCents(fee.annualFeeCents)}/yr · Add opened date`}
                          </Text>
                        </View>
                      </View>
                      <Badge
                        label={`${formatSignedCents(fee.netCents)}/yr`}
                        tone={fee.netCents >= 0 ? "green" : "red"}
                      />
                    </Pressable>
                  ))}
                  {hiddenFeeCount > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        tapHaptic();
                        setShowAllFees((v) => !v);
                      }}
                      style={[styles.expandRow, styles.rowDivider]}
                    >
                      <Text style={styles.linkText}>
                        {showAllFees ? "Show less" : `Show ${hiddenFeeCount} more`}
                      </Text>
                    </Pressable>
                  ) : null}
                </SectionCard>
              </View>
            );
          })()
        : null}

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
                  <View style={styles.rightValueRow}>
                    <Text style={[styles.itemTitle, NUM_STYLE]}>
                      {formatCents(card.capturedCents)}
                    </Text>
                    {card.breakEven ? (
                      <Badge
                        label={`${card.breakEven.pct}%`}
                        tone={
                          card.breakEven.state === "covered"
                            ? "green"
                            : card.breakEven.state === "behind"
                              ? "amber"
                              : "neutral"
                        }
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.itemMeta, NUM_STYLE]}>
                    of {formatCents(card.availableCents)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </SectionCard>
        </View>
      ) : null}

      {!data.yearEnd.inWindow && openCards.length > 0 ? (
        <Pressable onPress={onOpenYearEnd} style={styles.yearEndFooterLink}>
          <Text style={styles.linkText}>Preview year-end checklist →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
});

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 16,
    },
    topHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    brandBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: COLORS.primary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    brandBadgeText: {
      color: COLORS.primaryInk,
      fontSize: 15,
      fontWeight: "800",
    },
    screenTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: COLORS.ink,
      letterSpacing: -0.3,
    },
    screenSub: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 1,
    },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    heroCard: {
      backgroundColor: COLORS.heroBg,
      borderRadius: 18,
      padding: 16,
      gap: 12,
      shadowColor: "#0f1f3d",
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    heroEyebrow: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.9,
      color: COLORS.heroMuted,
    },
    heroValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    heroValue: {
      fontSize: 30,
      fontWeight: "800",
      color: COLORS.heroInk,
      letterSpacing: -0.6,
    },
    heroPctPill: {
      backgroundColor: COLORS.heroSurface,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    heroPctText: {
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.heroGold,
    },
    heroBreakEvenPill: {
      alignSelf: "flex-start",
      marginTop: 6,
      backgroundColor: COLORS.heroSurface,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    heroBreakEvenCovered: {
      backgroundColor: "rgba(52, 211, 153, 0.22)",
    },
    heroBreakEvenBehind: {
      backgroundColor: "rgba(251, 191, 36, 0.22)",
    },
    heroBreakEvenText: {
      fontSize: 11,
      fontWeight: "700",
      color: COLORS.heroInk,
    },
    heroBreakEvenCoveredText: {
      color: "#a7f3d0",
    },
    heroBreakEvenBehindText: {
      color: "#fde68a",
    },
    heroStatPill: {
      backgroundColor: COLORS.heroSurface,
      borderRadius: 12,
      paddingHorizontal: 11,
      paddingVertical: 8,
      alignItems: "flex-end",
      minWidth: 102,
    },
    heroPillLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: COLORS.heroMuted,
    },
    heroPillGold: {
      fontSize: 16,
      fontWeight: "800",
      color: COLORS.heroGold,
      marginTop: 1,
    },
    heroPillSub: {
      fontSize: 10,
      color: COLORS.heroMuted,
    },
    heroTrack: {
      position: "relative",
      height: 7,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      overflow: "hidden",
    },
    heroFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: COLORS.heroGold,
    },
    heroMarker: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: "rgba(255,255,255,0.85)",
      marginLeft: -1,
    },
    heroFootRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    heroFootText: {
      fontSize: 11.5,
      color: COLORS.heroMuted,
      flexShrink: 1,
    },
    heroPointsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.14)",
      paddingTop: 10,
    },
    heroPointsLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.heroMuted,
    },
    heroPointsValue: {
      fontSize: 13.5,
      fontWeight: "700",
      color: COLORS.heroInk,
    },
    calloutAmber: {
      backgroundColor: COLORS.amberBg,
      borderColor: COLORS.amberBorder,
      gap: 10,
    },
    calloutAmberTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.amberInk,
    },
    calloutAmberBody: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.amberInk,
    },
    calloutDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.amberBorder,
      paddingTop: 10,
    },
    catalogUpdateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    referralCallout: {
      gap: 8,
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
      gap: 8,
    },
    sectionHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    sectionMeta: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.muted,
    },
    linkText: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.primary,
    },
    expandRow: {
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
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
      paddingVertical: 11,
      paddingLeft: 10,
      borderLeftWidth: 3.5,
      borderLeftColor: "transparent",
      gap: 8,
    },
    creditRowUrgent: {
      borderLeftColor: COLORS.redFill,
    },
    creditRowSoon: {
      borderLeftColor: COLORS.amberFill,
    },
    creditRowNormal: {
      borderLeftColor: COLORS.border,
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
    amountPill: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    amountPillUrgent: {
      backgroundColor: COLORS.redBg,
    },
    creditAmount: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.primary,
    },
    creditAmountUrgent: {
      color: COLORS.redInk,
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
      borderRadius: 10,
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
      gap: 2,
    },
    rightValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
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
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    catChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.ink,
    },
    catChipTextActive: {
      color: COLORS.primaryInk,
    },
    pickList: {
      marginTop: 4,
      gap: 4,
    },
    offerBanner: {
      backgroundColor: COLORS.greenBg,
      borderColor: COLORS.greenBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    offerBannerText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.greenInk,
    },
    yearEndFooterLink: {
      alignItems: "center",
      paddingVertical: 4,
    },
  });

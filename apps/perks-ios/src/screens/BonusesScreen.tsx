import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Linking,
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
  COLORS,
  FieldInput,
  NUM_STYLE,
  SectionCard,
} from "../components/ui";
import { formatDate, formatInteger } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  BonusOffer,
  BonusVerdict,
  MobileActionPayload,
  MobileBootstrap,
  MobileReferral,
} from "../types";

const BonusOfferCard = React.memo(function BonusOfferCard({
  offer,
  verdict,
  friendReferrals,
}: {
  offer: BonusOffer;
  verdict: BonusVerdict;
  friendReferrals: MobileReferral[];
}) {
  const verdictBadge =
    verdict.status === "eligible"
      ? { label: "Looks eligible", tone: "green" as const }
      : verdict.status === "caution"
        ? { label: "Check terms", tone: "amber" as const }
        : { label: "Not eligible", tone: "red" as const };

  return (
    <SectionCard style={styles.offerCard}>
      <View style={styles.offerTop}>
        <View style={styles.flexShrink}>
          <Text style={styles.itemTitle}>{offer.card}</Text>
          <Text style={[styles.metaLine, NUM_STYLE]}>
            {offer.issuer}
            {offer.business ? " · Business" : ""} · ${offer.annualFee}/yr
          </Text>
        </View>
        <Badge label={verdictBadge.label} tone={verdictBadge.tone} />
      </View>

      <View style={styles.headlineRow}>
        <Text style={styles.bonusHeadline}>{offer.bonus}</Text>
        {offer.estValue ? (
          <Text style={[styles.estValue, NUM_STYLE]}>~${formatInteger(offer.estValue)}</Text>
        ) : null}
      </View>

      {offer.spend ? <Text style={styles.noteText}>Spend: {offer.spend}</Text> : null}

      <View style={styles.badgeWrap}>
        {offer.elevated ? <Badge label="Elevated offer" tone="green" /> : null}
        {offer.noLifetimeLanguage ? <Badge label="No lifetime language" tone="neutral" /> : null}
      </View>

      {verdict.reasons.map((reason, idx) => (
        <Text key={idx} style={styles.reasonText}>
          • {reason}
        </Text>
      ))}

      {offer.note ? <Text style={styles.noteText}>{offer.note}</Text> : null}

      {friendReferrals.length > 0 ? (
        <View style={styles.friendLinksWrap}>
          {friendReferrals.map((ref) => (
            <Pressable
              key={ref.id}
              onPress={() => void Linking.openURL(ref.url)}
              style={styles.friendLinkBanner}
            >
              <Text style={styles.friendLinkText}>
                Use {ref.firstName}’s referral link
                {ref.reward ? ` (earns them ${ref.reward})` : ""} →
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {offer.url ? (
        <Pressable onPress={() => void Linking.openURL(offer.url!)}>
          <Text style={styles.linkText}>View public offer →</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
});

function ItemSpacer() {
  return <View style={styles.itemSpacer} />;
}

export const BonusesScreen = React.memo(function BonusesScreen({
  data,
  refreshing,
  busyKey,
  onRefresh,
  onAction,
  headerSlot,
  initialShareTemplateKey,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  busyKey: string | null;
  onRefresh: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  headerSlot?: React.ReactNode;
  initialShareTemplateKey?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "eligible">("all");
  const [shareOpen, setShareOpen] = useState(Boolean(initialShareTemplateKey));
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    initialShareTemplateKey ??
      data.referrals.shareableCards[0]?.templateKey ??
      data.catalog[0]?.key ??
      "",
  );
  const [customCardName, setCustomCardName] = useState("");
  const [useCustomCard, setUseCustomCard] = useState(false);
  const [referralUrl, setReferralUrl] = useState("");
  const [referralReward, setReferralReward] = useState("");

  useEffect(() => {
    if (initialShareTemplateKey) {
      setSelectedTemplate(initialShareTemplateKey);
      setUseCustomCard(false);
      setShareOpen(true);
    }
  }, [initialShareTemplateKey]);

  const fiveCount = data.bonuses.fiveTwentyFour;
  const under524 = fiveCount < 5;

  // Put user's held open catalog cards at the top of the picker, followed by the rest of the catalog
  const heldKeys = useMemo(
    () =>
      new Set(
        data.cards.filter((c) => !c.closed && c.templateKey).map((c) => c.templateKey as string),
      ),
    [data.cards],
  );
  const orderedCatalog = useMemo(
    () => [
      ...data.catalog.filter((t) => heldKeys.has(t.key)),
      ...data.catalog.filter((t) => !heldKeys.has(t.key)),
    ],
    [data.catalog, heldKeys],
  );

  const visibleOffers = useMemo(
    () =>
      filter === "eligible"
        ? data.bonuses.offers.filter((o) => o.verdict.status !== "ineligible")
        : data.bonuses.offers,
    [data.bonuses.offers, filter],
  );

  async function pasteUrlFromClipboard() {
    const clip = (await Clipboard.getStringAsync()).trim();
    if (clip) setReferralUrl(clip);
  }

  async function submitReferral() {
    await onAction(
      {
        type: "referral.add",
        card: useCustomCard ? undefined : selectedTemplate,
        cardName: useCustomCard ? customCardName : undefined,
        url: referralUrl,
        reward: referralReward,
      },
      "referral.add",
    );
    setReferralUrl("");
    setReferralReward("");
    setCustomCardName("");
    setShareOpen(false);
  }

  return (
    <FlatList
      data={visibleOffers}
      keyExtractor={(item) => item.offer.id}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={ItemSpacer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.headerContainer}>
          {headerSlot}

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Bonuses & referrals</Text>
            <Text style={styles.subtitle}>
              Shared referral links, issuer rules, and sign-up bonus eligibility from your card
              history.
            </Text>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.filterHeader}>
              <Text style={styles.sectionTitle}>Referral links</Text>
              <Button
                label={shareOpen ? "Close" : "Share a link"}
                size="sm"
                variant={shareOpen ? "secondary" : "primary"}
                onPress={() => setShareOpen((v) => !v)}
              />
            </View>

            {data.referrals.shareableCards.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shareableRow}
              >
                {data.referrals.shareableCards.map((c) => (
                  <Pressable
                    key={c.cardId}
                    onPress={() => {
                      tapHaptic();
                      setSelectedTemplate(c.templateKey);
                      setUseCustomCard(false);
                      setShareOpen(true);
                    }}
                    style={styles.shareableChip}
                  >
                    <CardSwatch style={c.style} />
                    <Text style={styles.shareableName}>{c.name}</Text>
                    <Text style={styles.shareableAction}>Share</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {shareOpen ? (
              <SectionCard style={styles.shareForm}>
                <View style={styles.modeRow}>
                  <Pressable
                    onPress={() => setUseCustomCard(false)}
                    style={[styles.modeBtn, !useCustomCard && styles.modeBtnActive]}
                  >
                    <Text style={[styles.modeText, !useCustomCard && styles.modeTextActive]}>
                      Catalog card
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setUseCustomCard(true)}
                    style={[styles.modeBtn, useCustomCard && styles.modeBtnActive]}
                  >
                    <Text style={[styles.modeText, useCustomCard && styles.modeTextActive]}>
                      Other card
                    </Text>
                  </Pressable>
                </View>

                {!useCustomCard ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shareableRow}
                  >
                    {orderedCatalog.map((t) => {
                      const active = t.key === selectedTemplate;
                      return (
                        <Pressable
                          key={t.key}
                          onPress={() => {
                            tapHaptic();
                            setSelectedTemplate(t.key);
                          }}
                          style={[styles.pill, active && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {t.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <FieldInput
                    label="Card name"
                    value={customCardName}
                    onChangeText={setCustomCardName}
                    placeholder="Chase Ink Business Preferred"
                  />
                )}

                <View style={styles.urlRow}>
                  <View style={styles.flexShrink}>
                    <FieldInput
                      label="Referral URL (https://...)"
                      value={referralUrl}
                      onChangeText={setReferralUrl}
                      placeholder="https://americanexpress.com/..."
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <Button
                    label="Paste"
                    size="sm"
                    variant="secondary"
                    style={styles.pasteBtn}
                    onPress={() => void pasteUrlFromClipboard()}
                  />
                </View>

                <FieldInput
                  label="Your referral bonus (optional)"
                  value={referralReward}
                  onChangeText={setReferralReward}
                  placeholder="15,000 points"
                />

                <Button
                  label="Share referral link"
                  loading={busyKey === "referral.add"}
                  onPress={() => void submitReferral()}
                />
              </SectionCard>
            ) : null}

            {data.referrals.others.length > 0 ? (
              <SectionCard style={styles.divideList}>
                <Text style={styles.subLabel}>Friends’ links</Text>
                {data.referrals.others.map((r, idx) => (
                  <View key={r.id} style={[styles.ruleRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.cardIdentity}>
                      <CardSwatch style={r.cardStyle} />
                      <View style={styles.flexShrink}>
                        <Text style={styles.itemTitle}>{r.cardName}</Text>
                        <Text style={styles.noteText}>
                          {r.firstName}’s link{r.reward ? ` · earns ${r.reward}` : ""}
                        </Text>
                      </View>
                    </View>
                    <Button
                      label="Open link"
                      size="sm"
                      variant="secondary"
                      onPress={() => void Linking.openURL(r.url)}
                    />
                  </View>
                ))}
              </SectionCard>
            ) : null}

            {data.referrals.mine.length > 0 ? (
              <SectionCard style={styles.divideList}>
                <Text style={styles.subLabel}>Your shared links</Text>
                {data.referrals.mine.map((r, idx) => (
                  <View key={r.id} style={[styles.ruleRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.cardIdentity}>
                      <CardSwatch style={r.cardStyle} />
                      <View style={styles.flexShrink}>
                        <Text style={styles.itemTitle}>{r.cardName}</Text>
                        {r.reward ? <Text style={styles.noteText}>{r.reward}</Text> : null}
                      </View>
                    </View>
                    <Button
                      label="Remove"
                      size="sm"
                      variant="ghost"
                      loading={busyKey === `referral.delete:${r.id}`}
                      onPress={() =>
                        void onAction(
                          { type: "referral.delete", id: r.id },
                          `referral.delete:${r.id}`,
                        )
                      }
                    />
                  </View>
                ))}
              </SectionCard>
            ) : null}

            {data.referrals.others.length === 0 &&
            data.referrals.mine.length === 0 &&
            !shareOpen ? (
              <SectionCard>
                <Text style={styles.noteText}>
                  No referral links shared yet. Add your links from “Refer a friend” in your card
                  app so sign-up bonuses stay in the group.
                </Text>
              </SectionCard>
            ) : null}
          </View>

          <SectionCard style={styles.fiveCard}>
            <View style={styles.fiveTop}>
              <View style={styles.flexShrink}>
                <Text style={styles.sectionTitle}>Chase 5/24</Text>
                <Text style={styles.noteText}>Personal cards opened in the last 24 months.</Text>
              </View>
              <Badge label={`${fiveCount} / 24`} tone={under524 ? "green" : "amber"} />
            </View>
          </SectionCard>

          {data.bonuses.rules.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Application rules</Text>
              <SectionCard style={styles.divideList}>
                {data.bonuses.rules.map((rule, idx) => (
                  <View key={rule.id} style={[styles.ruleRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.flexShrink}>
                      <Text style={styles.itemTitle}>{rule.title}</Text>
                      <Text style={styles.noteText}>{rule.detail}</Text>
                    </View>
                    <Badge
                      label={
                        rule.status === "clear"
                          ? "Clear"
                          : rule.until
                            ? `Wait ${formatDate(rule.until, data.today)}`
                            : "Wait"
                      }
                      tone={rule.status === "clear" ? "green" : "amber"}
                    />
                  </View>
                ))}
              </SectionCard>
            </View>
          ) : null}

          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Sign-up bonuses</Text>
            <View style={styles.filterPills}>
              <Pressable
                onPress={() => {
                  tapHaptic();
                  setFilter("all");
                }}
                style={[styles.pill, filter === "all" && styles.pillActive]}
              >
                <Text style={[styles.pillText, filter === "all" && styles.pillTextActive]}>
                  All ({data.bonuses.offers.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  tapHaptic();
                  setFilter("eligible");
                }}
                style={[styles.pill, filter === "eligible" && styles.pillActive]}
              >
                <Text style={[styles.pillText, filter === "eligible" && styles.pillTextActive]}>
                  Likely eligible
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <BonusOfferCard
          offer={item.offer}
          verdict={item.verdict}
          friendReferrals={item.friendReferrals}
        />
      )}
      ListFooterComponent={
        <CollapsibleSection title="How group referrals work">
          {() => (
            <View style={styles.howStack}>
              <Text style={styles.noteText}>
                1. Share yours: Add referral links from “Refer a friend” in your issuer’s app.
              </Text>
              <Text style={styles.noteText}>
                2. Use theirs: Applying through a friend’s link gets you the bonus and earns them
                one too.
              </Text>
              <Text style={styles.noteText}>
                Bonus list updated {formatDate(data.bonuses.asOf)}. Issuers make the final call.
              </Text>
            </View>
          )}
        </CollapsibleSection>
      }
    />
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  headerContainer: {
    gap: 16,
    marginBottom: 10,
  },
  itemSpacer: {
    height: 10,
  },
  headerBlock: {
    gap: 2,
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
    lineHeight: 18,
  },
  fiveCard: {
    paddingVertical: 12,
  },
  fiveTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flexShrink: {
    flex: 1,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
    paddingTop: 4,
    paddingBottom: 4,
  },
  divideList: {
    paddingVertical: 6,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ruleRow: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  shareableRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  shareableChip: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
  },
  shareableName: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.ink,
  },
  shareableAction: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.greenInk,
  },
  shareForm: {
    gap: 12,
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: COLORS.subtle,
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  modeBtnActive: {
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
  urlRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  pasteBtn: {
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.ink,
  },
  metaLine: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 1,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  filterPills: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
  },
  pillTextActive: {
    color: "#ffffff",
  },
  offerCard: {
    gap: 8,
  },
  offerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headlineRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  bonusHeadline: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
    flex: 1,
  },
  estValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.greenInk,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reasonText: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 17,
  },
  friendLinksWrap: {
    gap: 6,
    marginTop: 2,
  },
  friendLinkBanner: {
    backgroundColor: COLORS.greenBg,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  friendLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.greenInk,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink,
    marginTop: 2,
  },
  howStack: {
    gap: 6,
  },
});

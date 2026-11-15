import React, { useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Badge, COLORS, NUM_STYLE, SectionCard } from "../components/ui";
import { formatDate } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type { MobileBootstrap } from "../types";

export function BonusesScreen({
  data,
  refreshing,
  onRefresh,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "eligible">("all");
  const fiveCount = data.bonuses.fiveTwentyFour;
  const under524 = fiveCount < 5;

  const visibleOffers =
    filter === "eligible"
      ? data.bonuses.offers.filter((o) => o.verdict.status !== "ineligible")
      : data.bonuses.offers;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Bonuses</Text>
        <Text style={styles.subtitle}>
          Application rules and sign-up bonus eligibility from your card history.
        </Text>
      </View>

      <SectionCard style={styles.fiveCard}>
        <View style={styles.fiveTop}>
          <View style={styles.flexShrink}>
            <Text style={styles.sectionTitle}>Chase 5/24</Text>
            <Text style={styles.noteText}>Personal cards opened in the last 24 months.</Text>
          </View>
          <Badge label={`${fiveCount} / 5`} tone={under524 ? "green" : "amber"} />
        </View>
      </SectionCard>

      {data.bonuses.rules.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Issuer velocity rules</Text>
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

      <View style={styles.sectionBlock}>
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

        <View style={styles.offerStack}>
          {visibleOffers.map(({ offer, verdict }) => {
            const verdictBadge =
              verdict.status === "eligible"
                ? { label: "Looks clear", tone: "green" as const }
                : verdict.status === "caution"
                  ? { label: "Check rules", tone: "amber" as const }
                  : { label: "Likely ineligible", tone: "red" as const };

            return (
              <SectionCard key={offer.id} style={styles.offerCard}>
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
                    <Text style={[styles.estValue, NUM_STYLE]}>
                      ~${offer.estValue.toLocaleString("en-US")}
                    </Text>
                  ) : null}
                </View>

                {offer.spend ? <Text style={styles.noteText}>Spend: {offer.spend}</Text> : null}

                <View style={styles.badgeWrap}>
                  {offer.elevated ? <Badge label="Elevated offer" tone="green" /> : null}
                  {offer.noLifetimeLanguage ? (
                    <Badge label="No lifetime language" tone="neutral" />
                  ) : null}
                </View>

                {verdict.reasons.map((reason, idx) => (
                  <Text key={idx} style={styles.reasonText}>
                    • {reason}
                  </Text>
                ))}

                {offer.note ? <Text style={styles.noteText}>{offer.note}</Text> : null}

                {offer.url ? (
                  <Pressable onPress={() => void Linking.openURL(offer.url!)}>
                    <Text style={styles.linkText}>View offer details →</Text>
                  </Pressable>
                ) : null}
              </SectionCard>
            );
          })}
        </View>

        <Text style={styles.footNote}>
          Bonus list updated {formatDate(data.bonuses.asOf)}. Issuers make the final call.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 16,
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
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.ink,
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
  offerStack: {
    gap: 10,
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
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink,
    marginTop: 2,
  },
  footNote: {
    fontSize: 12,
    color: COLORS.faint,
    textAlign: "center",
    marginTop: 4,
  },
});

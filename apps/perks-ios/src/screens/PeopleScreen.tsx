import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, CardSwatch, COLORS, Meter, NUM_STYLE, SectionCard } from "../components/ui";
import { dueLabel, formatCents, formatDate, ordinal } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type { MobileBootstrap, MobilePersonCard, MobilePersonOfferGroup } from "../types";

const PersonCardItem = React.memo(function PersonCardItem({
  card,
  year,
}: {
  card: MobilePersonCard;
  year: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasBreakdown = card.credits.used.length > 0 || card.credits.unused.length > 0;

  return (
    <SectionCard style={styles.personCard}>
      <Pressable
        accessibilityRole="button"
        disabled={!hasBreakdown}
        onPress={() => {
          tapHaptic();
          setExpanded((v) => !v);
        }}
        style={styles.cardHeaderPress}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardIdentity}>
            <CardSwatch style={card.style} size="md" />
            <View style={styles.flexShrink}>
              <Text style={styles.cardTitle}>{card.name}</Text>
              <Text style={[styles.metaText, NUM_STYLE]}>
                {card.availableCents > 0
                  ? `${formatCents(card.capturedCents)} of ${formatCents(card.availableCents)} used · ${Math.round(card.share * 100)}%`
                  : "No credits tracked"}
              </Text>
            </View>
          </View>
          <View style={styles.rightCluster}>
            {card.place ? (
              <Badge
                label={`${ordinal(card.place.rank)} of ${card.place.of}`}
                tone={card.place.rank === 1 ? "green" : "neutral"}
              />
            ) : null}
            {hasBreakdown ? (
              <Text style={styles.chevronText}>{expanded ? "Hide" : "Credits"}</Text>
            ) : null}
          </View>
        </View>

        {card.availableCents > 0 ? (
          <Meter
            value={card.capturedCents}
            max={card.availableCents}
            tone={card.capturedCents >= card.availableCents ? "green" : "dark"}
          />
        ) : null}
      </Pressable>

      {expanded && hasBreakdown ? (
        <View style={styles.breakdownWrap}>
          {card.credits.used.length > 0 ? (
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownHeading}>Used most in {year}</Text>
              {card.credits.used.map((line) => (
                <View key={line.benefitId} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={[styles.breakdownVal, NUM_STYLE]}>
                    {formatCents(line.usedCents)}
                    {line.availableCents > 0 ? ` / ${formatCents(line.availableCents)}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {card.credits.unused.length > 0 ? (
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownHeading}>Still to use in {year}</Text>
              {card.credits.unused.map((line) => (
                <View key={line.benefitId} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={[styles.breakdownValMuted, NUM_STYLE]}>
                    {formatCents(line.leftCents)} left
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </SectionCard>
  );
});

const SharedOfferItem = React.memo(function SharedOfferItem({
  group,
  today,
}: {
  group: MobilePersonOfferGroup;
  today: string;
}) {
  const due = dueLabel(group.daysLeft);

  return (
    <View style={styles.offerRow}>
      <View style={styles.offerTop}>
        <Text style={styles.offerMerchant}>{group.merchant}</Text>
        <View style={styles.badgeWrap}>
          {group.rateLabel ? (
            <Badge
              label={group.rateLabel}
              tone={
                group.rate !== null && group.rate >= 0.5
                  ? "green"
                  : group.weak
                    ? "neutral"
                    : "amber"
              }
            />
          ) : null}
          {group.missingFromMine ? <Badge label="Not in your offers" tone="neutral" /> : null}
        </View>
      </View>

      <Text style={styles.offerDetails}>
        {group.details || "Added to card. Deal text wasn't saved."}
      </Text>

      <Text style={[styles.metaText, NUM_STYLE]}>
        {group.maxCents !== null ? `Up to ${formatCents(group.maxCents)} · ` : ""}
        {group.expiresOn ? `Expires ${formatDate(group.expiresOn, today)}` : "No expiry saved"}
        {due ? ` (${due})` : ""}
      </Text>

      {group.cards.length > 0 ? (
        <View style={styles.offerCardChips}>
          {group.cards.map((c) => (
            <View key={c.id} style={styles.offerCardChip}>
              <CardSwatch style={c.cardStyle} />
              <Text style={styles.offerCardName} numberOfLines={1}>
                {c.cardName}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

export const PeopleScreen = React.memo(function PeopleScreen({
  data,
  refreshing,
  onRefresh,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { leaderboard, others } = data.people;
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const year = data.today.slice(0, 4);

  const person = useMemo(
    () => others.find((x) => x.id === selectedPersonId) ?? others[0] ?? null,
    [others, selectedPersonId],
  );

  const topCaptured = leaderboard[0]?.capturedCents || 1;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>People</Text>
        <Text style={styles.subtitle}>
          How everyone in the group is doing with their cards this year, and every Amex Offer and
          Chase Offer on their cards.
        </Text>
      </View>

      {leaderboard.length >= 2 ? (
        <SectionCard style={styles.leaderboardCard}>
          <Text style={styles.sectionLabel}>Credits used in {year}</Text>
          <View style={styles.leaderList}>
            {leaderboard.map((row, idx) => {
              const canSelect = !row.isMe && others.some((o) => o.id === row.userId);
              return (
                <Pressable
                  key={row.userId}
                  disabled={!canSelect}
                  onPress={() => {
                    tapHaptic();
                    setSelectedPersonId(row.userId);
                  }}
                  style={styles.leaderRow}
                >
                  <View style={styles.leaderTop}>
                    <View style={styles.leaderNameRow}>
                      <Text style={[styles.rankLabel, NUM_STYLE]}>{ordinal(idx + 1)}</Text>
                      <Text style={[styles.leaderName, row.isMe && styles.leaderNameMe]}>
                        {row.isMe ? "You" : row.firstName}
                      </Text>
                    </View>
                    <Text style={[styles.leaderStats, NUM_STYLE]}>
                      <Text style={styles.leaderAmount}>{formatCents(row.capturedCents)}</Text>
                      {row.availableCents > 0
                        ? ` of ${formatCents(row.availableCents)} · ${Math.round(row.share * 100)}%`
                        : ""}
                    </Text>
                  </View>
                  <Meter
                    value={row.capturedCents}
                    max={topCaptured}
                    tone={idx === 0 ? "green" : "dark"}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.footHint}>
            Only people sharing group rankings in Settings are listed.
          </Text>
        </SectionCard>
      ) : null}

      {!person ? (
        <SectionCard>
          <Text style={styles.subtitle}>
            Nobody else has added cards or pasted an offers page yet. Once they do, they show up
            here.
          </Text>
        </SectionCard>
      ) : (
        <>
          {others.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.personPills}
            >
              {others.map((p) => {
                const active = p.id === person.id;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tapHaptic();
                      setSelectedPersonId(p.id);
                    }}
                    style={[styles.personPill, active && styles.personPillActive]}
                  >
                    <Text style={[styles.personPillText, active && styles.personPillTextActive]}>
                      {p.firstName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>{person.firstName}’s cards</Text>
            {person.cards && person.cards.length > 0 ? (
              <>
                <Text style={styles.metaText}>Tap a card to see its credit breakdown.</Text>
                <View style={styles.cardStack}>
                  {person.cards.map((c) => (
                    <PersonCardItem key={c.cardId} card={c} year={year} />
                  ))}
                </View>
              </>
            ) : (
              <SectionCard>
                <Text style={styles.subtitle}>
                  {person.sharing
                    ? "No open cards yet."
                    : `${person.firstName} keeps card totals private (Group rankings is off in their Settings).`}
                </Text>
              </SectionCard>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>
              {person.firstName}’s offers{" "}
              <Text style={styles.countText}>· {person.offers?.groups.length ?? 0} available</Text>
            </Text>

            {!person.offers || person.offers.groups.length === 0 ? (
              <SectionCard>
                <Text style={styles.subtitle}>No offers pasted yet.</Text>
              </SectionCard>
            ) : (
              <>
                <Text
                  style={[
                    styles.freshnessText,
                    person.offers.stale ? styles.freshnessStale : styles.freshnessFresh,
                  ]}
                >
                  {person.offers.lastPastedOn
                    ? `Last pasted ${formatDate(person.offers.lastPastedOn, data.today)}${
                        person.offers.stale ? ", so this may be out of date" : ""
                      }. Offers are targeted, so these may not be on your cards.`
                    : "Pasted without picking a card, so freshness is unknown."}
                </Text>

                <SectionCard style={styles.divideCard}>
                  {person.offers.groups.map((g, idx) => (
                    <View key={g.key} style={idx > 0 ? styles.rowDivider : undefined}>
                      <SharedOfferItem group={g} today={data.today} />
                    </View>
                  ))}
                </SectionCard>
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 16,
  },
  headerBlock: {
    gap: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  leaderboardCard: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  leaderList: {
    gap: 12,
  },
  leaderRow: {
    gap: 6,
  },
  leaderTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  leaderNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  rankLabel: {
    width: 28,
    fontSize: 13,
    color: COLORS.muted,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.ink,
  },
  leaderNameMe: {
    fontWeight: "700",
  },
  leaderStats: {
    fontSize: 13,
    color: COLORS.muted,
  },
  leaderAmount: {
    fontWeight: "600",
    color: COLORS.ink,
  },
  footHint: {
    fontSize: 12,
    color: COLORS.faint,
  },
  personPills: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  personPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  personPillActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  personPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink,
  },
  personPillTextActive: {
    color: "#ffffff",
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
  },
  countText: {
    fontWeight: "400",
    color: COLORS.muted,
  },
  cardStack: {
    gap: 10,
  },
  personCard: {
    gap: 10,
  },
  cardHeaderPress: {
    gap: 8,
  },
  cardTopRow: {
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
  flexShrink: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.ink,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 1,
  },
  rightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chevronText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.muted,
  },
  breakdownWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    gap: 10,
  },
  breakdownCol: {
    gap: 4,
  },
  breakdownHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  breakdownName: {
    fontSize: 13,
    color: COLORS.ink,
    flex: 1,
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.ink,
  },
  breakdownValMuted: {
    fontSize: 13,
    color: COLORS.muted,
  },
  freshnessText: {
    fontSize: 12,
    lineHeight: 17,
  },
  freshnessFresh: {
    color: COLORS.muted,
  },
  freshnessStale: {
    color: COLORS.redInk,
  },
  divideCard: {
    paddingVertical: 4,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  offerRow: {
    paddingVertical: 11,
    gap: 4,
  },
  offerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  offerMerchant: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.ink,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  offerDetails: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  offerCardChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  offerCardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  offerCardName: {
    fontSize: 12,
    color: COLORS.muted,
  },
});

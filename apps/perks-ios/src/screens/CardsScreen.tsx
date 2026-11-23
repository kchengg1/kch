import React, { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Badge,
  Button,
  CardSwatch,
  CardWalletHeader,
  CollapsibleSection,
  FieldInput,
  Meter,
  NUM_STYLE,
  SectionCard,
  SegmentedBar,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import { CATEGORIES, classify, EARN_REVIEWED, rankCards } from "../lib/earn";
import { centsToInputDollars, formatCents, formatCpp, formatDate } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  CardsSubTabKey,
  MobileActionPayload,
  MobileBootstrap,
  MobileCard,
  TabKey,
} from "../types";
import { BonusesScreen } from "./BonusesScreen";

const SUB_TABS: { key: CardsSubTabKey; label: string }[] = [
  { key: "cards", label: "My cards" },
  { key: "pick", label: "Which card?" },
  { key: "bonuses", label: "Bonuses & links" },
];

const CardListItem = React.memo(function CardListItem({
  card,
  today,
  walletCard = false,
  onOpenCard,
}: {
  card: MobileCard;
  today: string;
  walletCard?: boolean;
  onOpenCard: (cardId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const feeLabel = card.annualFeeCents > 0 ? `${formatCents(card.annualFeeCents)}/yr` : "$0/yr";
  const issuerLine = `${card.issuer || "Card"}${card.business ? " · Business" : ""}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapHaptic();
        onOpenCard(card.id);
      }}
      style={walletCard ? styles.walletItem : styles.cardItem}
    >
      {walletCard ? (
        <CardWalletHeader
          cardStyle={card.style}
          issuer={issuerLine}
          name={card.name}
          feeLabel={feeLabel}
          closed={card.closed}
        />
      ) : (
        <View style={styles.cardTopRow}>
          <View style={styles.cardIdentity}>
            <CardSwatch style={card.style} size="md" />
            <View style={styles.flexShrink}>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardSub}>
                {issuerLine}
                {card.openedOn ? ` · Opened ${formatDate(card.openedOn, today)}` : ""}
              </Text>
            </View>
          </View>
          <Text style={[styles.feeLabel, NUM_STYLE]}>{feeLabel}</Text>
        </View>
      )}

      <View style={walletCard ? styles.walletBody : styles.cardBodyFlat}>
        {!card.closed && card.availableCents > 0 ? (
          <View style={styles.meterWrap}>
            <View style={styles.meterFoot}>
              <Text style={[styles.cardSub, NUM_STYLE]}>
                <Text style={styles.capturedStrong}>{formatCents(card.capturedCents)}</Text> of{" "}
                {formatCents(card.availableCents)} used
              </Text>
              {card.breakEven ? (
                <Badge
                  label={`${card.breakEven.pct}% · ${
                    card.breakEven.state === "covered"
                      ? "Covered"
                      : card.breakEven.state === "on-pace"
                        ? "On pace"
                        : "Behind"
                  }`}
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
            <Meter
              value={card.capturedCents}
              max={card.availableCents}
              marker={card.annualFeeCents > 0 ? card.annualFeeCents : undefined}
              tone={card.capturedCents >= card.availableCents ? "green" : "dark"}
            />
          </View>
        ) : null}

        <View style={styles.badgeWrap}>
          {!card.closed && card.catalogUpdates.count > 0 ? (
            <Badge
              label={`${card.catalogUpdates.count} catalog update${card.catalogUpdates.count === 1 ? "" : "s"}`}
              tone="amber"
            />
          ) : null}
          {card.msr && card.msr.state === "active" ? (
            <Badge label={`Bonus: ${formatCents(card.msr.leftCents)} left`} tone="amber" />
          ) : null}
          {card.msr && card.msr.state === "met" ? (
            <Badge label="Bonus spend met" tone="green" />
          ) : null}
          {card.nextFeeOn && !card.closed ? (
            <Badge label={`Fee ${formatDate(card.nextFeeOn, today)}`} tone="neutral" />
          ) : null}
          {card.closed ? <Badge label="Closed" tone="neutral" /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const WhichCardPane = React.memo(function WhichCardPane({
  data,
  refreshing,
  headerSlot,
  onRefresh,
  onOpenCard,
  onNavigateTab,
  onAddFirstCard,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  headerSlot: React.ReactNode;
  onRefresh: () => void;
  onOpenCard: (cardId: string) => void;
  onNavigateTab: (tab: TabKey) => void;
  onAddFirstCard: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState("Dining");
  const openCards = useMemo(() => data.cards.filter((c) => !c.closed), [data.cards]);
  const cardById = useMemo(() => new Map(openCards.map((c) => [c.id, c])), [openCards]);
  const valueByProgram = useMemo(
    () => new Map(data.points.programs.map((p) => [p.program, p.centsPerPoint])),
    [data.points.programs],
  );

  const trimmed = query.trim();
  const target = useMemo(() => classify(trimmed || "other"), [trimmed]);
  const categoryLabel =
    CATEGORIES.find((c) => c.id === target.category)?.label ?? "Everything else";
  const picks = useMemo(
    () => rankCards(openCards, target, (program) => valueByProgram.get(program) ?? 1),
    [openCards, target, valueByProgram],
  );
  const matchingOffers = useMemo(
    () =>
      trimmed.length >= 3
        ? [...data.offers.strong, ...data.offers.weak].filter((g) =>
            g.merchant.toLowerCase().includes(trimmed.toLowerCase()),
          )
        : [],
    [data.offers.strong, data.offers.weak, trimmed],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      {headerSlot}

      <View style={styles.headerBlock}>
        <Text style={styles.title}>Which card?</Text>
        <Text style={styles.subtitle}>
          Type a merchant or pick a spending category to rank your open cards by estimated return.
        </Text>
      </View>

      {openCards.length === 0 ? (
        <SectionCard style={styles.panelGap}>
          <Text style={styles.cardSub}>
            Add at least one open card from the catalog to compare earn rates across categories.
          </Text>
          <Button label="Add a card" size="sm" onPress={onAddFirstCard} />
        </SectionCard>
      ) : (
        <>
          <SectionCard style={styles.panelGap}>
            <View style={styles.searchHeaderRow}>
              <Text style={styles.searchLabel}>Merchant or category</Text>
              {trimmed ? (
                <Pressable onPress={() => setQuery("")}>
                  <Text style={styles.clearLink}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Whole Foods, Hyatt, Costco, dining, flights..."
              placeholderTextColor={colors.faint}
              style={styles.searchInput}
            />
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => {
                const active =
                  trimmed.toLowerCase() === cat.label.toLowerCase() ||
                  (!trimmed && cat.id === "other");
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      tapHaptic();
                      setQuery(cat.label);
                    }}
                    style={[styles.catChip, active && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {matchingOffers.length > 0 ? (
            <SectionCard style={styles.offerAlertCard}>
              <Text style={styles.offerAlertTitle}>Saved card offers matching “{trimmed}”</Text>
              {matchingOffers.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => onNavigateTab("offers")}
                  style={styles.offerAlertRow}
                >
                  <Text style={styles.offerAlertText}>
                    {o.merchant}: {o.details} →
                  </Text>
                </Pressable>
              ))}
            </SectionCard>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Ranked for {categoryLabel}
              {target.chain ? ` (${target.chain})` : ""}
            </Text>
            <Text style={[styles.cardSub, NUM_STYLE]}>{picks.length} cards</Text>
          </View>

          {picks.length === 0 ? (
            <SectionCard>
              <Text style={styles.cardSub}>
                None of your open cards are linked to a built-in catalog template yet. Open a card
                and sync its template to rank earn rates.
              </Text>
            </SectionCard>
          ) : (
            <View style={styles.cardStack}>
              {picks.map((p, idx) => {
                const card = cardById.get(p.cardId);
                return (
                  <Pressable
                    key={p.cardId}
                    accessibilityRole="button"
                    onPress={() => {
                      tapHaptic();
                      onOpenCard(p.cardId);
                    }}
                  >
                    <SectionCard style={styles.pickCard}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardIdentity}>
                          {card ? <CardSwatch style={card.style} size="md" /> : null}
                          <View style={styles.flexShrink}>
                            <Text style={styles.cardName}>{p.cardName}</Text>
                            <Text style={[styles.cardSub, NUM_STYLE]}>
                              {Number(p.x.toFixed(2))}x {p.currency}
                              {p.currency !== "Cash back"
                                ? ` · valued at ${formatCpp(p.centsPerPoint)}`
                                : ""}
                            </Text>
                          </View>
                        </View>
                        <Badge label={`~${p.returnPct}%`} tone={idx === 0 ? "green" : "neutral"} />
                      </View>
                      {p.note ? <Text style={styles.pickNote}>{p.note}</Text> : null}
                      {p.portal ? <Text style={styles.portalNote}>Portal: {p.portal}</Text> : null}
                      {p.rotating ? (
                        <Badge label="Has rotating 5% quarterly categories" tone="amber" />
                      ) : null}
                    </SectionCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      <Text style={styles.footNote}>Earn rates last reviewed {formatDate(EARN_REVIEWED)}.</Text>
    </ScrollView>
  );
});

export const CardsScreen = React.memo(function CardsScreen({
  data,
  refreshing,
  busyKey,
  subTab,
  onSubTabChange,
  shareTemplateKey,
  onRefresh,
  onAction,
  onVoidAction,
  onOpenCard,
  onOpenCatchUp,
  onNavigateTab,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  busyKey: string | null;
  subTab: CardsSubTabKey;
  onSubTabChange: (tab: CardsSubTabKey) => void;
  shareTemplateKey?: string | null;
  onRefresh: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<string | undefined>;
  onVoidAction: (payload: MobileActionPayload, key: string) => Promise<void>;
  onOpenCard: (cardId: string) => void;
  onOpenCatchUp: () => void;
  onNavigateTab: (tab: TabKey) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [panel, setPanel] = useState<"none" | "add" | "import">("none");
  const [addMode, setAddMode] = useState<"catalog" | "custom">("catalog");
  const [catalogFilter, setCatalogFilter] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>(data.catalog[0]?.key ?? "");
  const [customName, setCustomName] = useState("");
  const [customIssuer, setCustomIssuer] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [business, setBusiness] = useState(false);
  const [sheetText, setSheetText] = useState("");

  const openCards = useMemo(() => data.cards.filter((c) => !c.closed), [data.cards]);
  const closedCards = useMemo(() => data.cards.filter((c) => c.closed), [data.cards]);

  const filteredCatalog = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase();
    if (!q) return data.catalog;
    return data.catalog.filter(
      (c) => c.name.toLowerCase().includes(q) || c.issuer.toLowerCase().includes(q),
    );
  }, [catalogFilter, data.catalog]);

  const segmentedBar = (
    <SegmentedBar<CardsSubTabKey> options={SUB_TABS} value={subTab} onChange={onSubTabChange} />
  );

  if (subTab === "bonuses") {
    return (
      <BonusesScreen
        data={data}
        refreshing={refreshing}
        busyKey={busyKey}
        onRefresh={onRefresh}
        onAction={onVoidAction}
        headerSlot={segmentedBar}
        initialShareTemplateKey={shareTemplateKey}
      />
    );
  }

  if (subTab === "pick") {
    return (
      <WhichCardPane
        data={data}
        refreshing={refreshing}
        headerSlot={segmentedBar}
        onRefresh={onRefresh}
        onOpenCard={onOpenCard}
        onNavigateTab={onNavigateTab}
        onAddFirstCard={() => {
          onSubTabChange("cards");
          setPanel("add");
        }}
      />
    );
  }

  async function submitAddCard() {
    const payload: MobileActionPayload =
      addMode === "catalog"
        ? {
            type: "card.add",
            template: selectedTemplate,
            annualFee: annualFee.trim() || undefined,
            openedOn: openedOn.trim() || undefined,
          }
        : {
            type: "card.add",
            name: customName,
            issuer: customIssuer,
            annualFee: annualFee.trim() || "0",
            openedOn: openedOn.trim() || undefined,
            business,
          };

    const newCardId = await onAction(payload, "card.add");
    setPanel("none");
    setCustomName("");
    setCustomIssuer("");
    setAnnualFee("");
    setOpenedOn("");
    if (newCardId) {
      onOpenCard(newCardId);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      {segmentedBar}

      <View style={styles.headerRow}>
        <View style={styles.flexShrink}>
          <Text style={styles.title}>Cards</Text>
          <Text style={styles.subtitle}>
            {openCards.length} open
            {closedCards.length > 0 ? ` · ${closedCards.length} closed` : ""}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Button
            label={panel === "add" ? "Close" : "Add card"}
            size="sm"
            variant={panel === "add" ? "secondary" : "primary"}
            onPress={() => setPanel(panel === "add" ? "none" : "add")}
          />
          <Button
            label={panel === "import" ? "Close" : "Import"}
            size="sm"
            variant="secondary"
            onPress={() => setPanel(panel === "import" ? "none" : "import")}
          />
          <Button label="Catch up" size="sm" variant="secondary" onPress={onOpenCatchUp} />
        </View>
      </View>

      {panel === "add" ? (
        <SectionCard style={styles.panelGap}>
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => setAddMode("catalog")}
              style={[styles.modeBtn, addMode === "catalog" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, addMode === "catalog" && styles.modeTextActive]}>
                Built-in card
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddMode("custom")}
              style={[styles.modeBtn, addMode === "custom" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, addMode === "custom" && styles.modeTextActive]}>
                Custom card
              </Text>
            </Pressable>
          </View>

          {addMode === "catalog" ? (
            <>
              <FieldInput
                label="Search built-in cards"
                value={catalogFilter}
                onChangeText={setCatalogFilter}
                placeholder="Platinum, Sapphire, Venture X..."
              />
              <View style={styles.templateList}>
                {filteredCatalog.slice(0, 14).map((t) => {
                  const active = t.key === selectedTemplate;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => {
                        tapHaptic();
                        setSelectedTemplate(t.key);
                        setAnnualFee(centsToInputDollars(t.annualFeeCents));
                      }}
                      style={[styles.templateRow, active && styles.templateRowActive]}
                    >
                      <CardSwatch style={t.style} />
                      <View style={styles.flexShrink}>
                        <Text style={styles.templateName}>{t.name}</Text>
                        <Text style={styles.cardSub}>
                          {t.issuer} · {formatCents(t.annualFeeCents)}/yr
                        </Text>
                      </View>
                      <Text style={styles.radioMark}>{active ? "●" : "○"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <FieldInput
                label="Card name"
                value={customName}
                onChangeText={setCustomName}
                placeholder="Bilt Palladium"
              />
              <FieldInput
                label="Issuer"
                value={customIssuer}
                onChangeText={setCustomIssuer}
                placeholder="Chase, Amex, Citi..."
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Business card</Text>
                <Switch value={business} onValueChange={setBusiness} />
              </View>
            </>
          )}

          <View style={styles.twoCol}>
            <View style={styles.flexShrink}>
              <FieldInput
                label="Opened date (optional)"
                value={openedOn}
                onChangeText={setOpenedOn}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.flexShrink}>
              <FieldInput
                label="Annual fee ($)"
                value={annualFee}
                onChangeText={setAnnualFee}
                placeholder="95"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Button
            label="Add card"
            loading={busyKey === "card.add"}
            onPress={() => void submitAddCard()}
          />
        </SectionCard>
      ) : null}

      {panel === "import" ? (
        <SectionCard style={styles.panelGap}>
          <FieldInput
            label="Paste rows from your card spreadsheet"
            value={sheetText}
            onChangeText={setSheetText}
            multiline
            placeholder={
              "Amex Platinum\t2024-03-12\t$695\nChase Sapphire Preferred\t2023-08-01\t$95"
            }
            hint="Tab- or comma-separated lines with card name, open date, annual fee, or closed status."
          />
          <Button
            label="Import cards"
            loading={busyKey === "card.importSheet"}
            onPress={() =>
              void onAction(
                { type: "card.importSheet", sheet: sheetText },
                "card.importSheet",
              ).then(() => {
                setSheetText("");
                setPanel("none");
              })
            }
          />
        </SectionCard>
      ) : null}

      {openCards.length === 0 ? (
        <SectionCard>
          <Text style={styles.cardSub}>
            No open cards yet. Tap Add card above to pick from {data.catalog.length} built-in
            templates.
          </Text>
        </SectionCard>
      ) : (
        <View style={styles.cardStack}>
          {openCards.map((card) => (
            <SectionCard key={card.id} style={styles.walletSectionCard}>
              <CardListItem card={card} today={data.today} walletCard onOpenCard={onOpenCard} />
            </SectionCard>
          ))}
        </View>
      )}

      {closedCards.length > 0 ? (
        <CollapsibleSection title="Closed cards" countLabel={`${closedCards.length}`}>
          {() => (
            <View style={styles.closedStack}>
              {closedCards.map((card, idx) => (
                <View key={card.id} style={idx > 0 ? styles.rowDivider : undefined}>
                  <CardListItem card={card} today={data.today} onOpenCard={onOpenCard} />
                </View>
              ))}
            </View>
          )}
        </CollapsibleSection>
      ) : null}

      <Text style={styles.footNote}>
        Built-in card benefits last reviewed {formatDate(data.catalogReviewed)}.
      </Text>
    </ScrollView>
  );
});

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 14,
    },
    headerBlock: {
      gap: 3,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10,
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
      lineHeight: 18,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    buttonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    panelGap: {
      gap: 12,
    },
    modeSwitch: {
      flexDirection: "row",
      backgroundColor: COLORS.subtle,
      borderRadius: 10,
      padding: 3,
    },
    modeBtn: {
      flex: 1,
      minHeight: 36,
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
    templateList: {
      maxHeight: 280,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      overflow: "hidden",
    },
    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    templateRowActive: {
      backgroundColor: COLORS.primarySoft,
    },
    templateName: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.ink,
    },
    radioMark: {
      fontSize: 15,
      color: COLORS.primary,
    },
    twoCol: {
      flexDirection: "row",
      gap: 10,
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
    cardStack: {
      gap: 12,
    },
    walletSectionCard: {
      padding: 0,
      overflow: "hidden",
    },
    walletItem: {
      gap: 0,
    },
    walletBody: {
      padding: 13,
      gap: 9,
    },
    cardBodyFlat: {
      gap: 9,
    },
    capturedStrong: {
      fontWeight: "700",
      color: COLORS.ink,
    },
    closedStack: {
      gap: 10,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: 10,
    },
    cardItem: {
      gap: 10,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
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
    cardName: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    cardSub: {
      fontSize: 13,
      color: COLORS.muted,
      marginTop: 1,
    },
    feeLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: COLORS.ink,
    },
    meterWrap: {
      gap: 7,
    },
    meterFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 6,
    },
    badgeWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    searchHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    searchLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.muted,
    },
    clearLink: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.primary,
    },
    searchInput: {
      minHeight: 42,
      borderWidth: 1,
      borderColor: COLORS.borderStrong,
      borderRadius: 11,
      paddingHorizontal: 12,
      fontSize: 15,
      color: COLORS.ink,
      backgroundColor: COLORS.bg,
    },
    catGrid: {
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
    offerAlertCard: {
      backgroundColor: COLORS.greenBg,
      borderColor: COLORS.greenBorder,
      gap: 6,
    },
    offerAlertTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.greenInk,
    },
    offerAlertRow: {
      paddingVertical: 2,
    },
    offerAlertText: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.greenInk,
    },
    pickCard: {
      gap: 8,
    },
    pickNote: {
      fontSize: 13,
      color: COLORS.muted,
      lineHeight: 18,
    },
    portalNote: {
      fontSize: 12,
      color: COLORS.faint,
      lineHeight: 17,
    },
    footNote: {
      fontSize: 12,
      color: COLORS.faint,
      textAlign: "center",
      marginTop: 4,
    },
  });

import React, { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Badge,
  Button,
  CardSwatch,
  CollapsibleSection,
  COLORS,
  FieldInput,
  Meter,
  NUM_STYLE,
  SectionCard,
} from "../components/ui";
import { centsToInputDollars, formatCents, formatDate, formatSignedCents } from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type { MobileActionPayload, MobileBootstrap, MobileCard } from "../types";

const CardListItem = React.memo(function CardListItem({
  card,
  today,
  onOpenCard,
}: {
  card: MobileCard;
  today: string;
  onOpenCard: (cardId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tapHaptic();
        onOpenCard(card.id);
      }}
      style={styles.cardItem}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdentity}>
          <CardSwatch style={card.style} size="md" />
          <View style={styles.flexShrink}>
            <Text style={styles.cardName}>{card.name}</Text>
            <Text style={styles.cardSub}>
              {card.issuer || "Card"}
              {card.business ? " · Business" : ""}
              {card.openedOn ? ` · Opened ${formatDate(card.openedOn, today)}` : ""}
            </Text>
          </View>
        </View>
        <Text style={[styles.feeLabel, NUM_STYLE]}>
          {card.annualFeeCents > 0 ? `${formatCents(card.annualFeeCents)}/yr` : "$0/yr"}
        </Text>
      </View>

      {!card.closed && card.availableCents > 0 ? (
        <View style={styles.meterWrap}>
          <Meter
            value={card.capturedCents}
            max={card.availableCents}
            tone={card.capturedCents >= card.availableCents ? "green" : "dark"}
          />
          <View style={styles.meterFoot}>
            <Text style={[styles.cardSub, NUM_STYLE]}>
              {formatCents(card.capturedCents)} of {formatCents(card.availableCents)} used
            </Text>
            {card.annualFeeCents > 0 ? (
              <Badge
                label={`Worth ${formatSignedCents(card.worth.netCents)}/yr`}
                tone={card.worth.netCents >= 0 ? "green" : "amber"}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.badgeWrap}>
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
    </Pressable>
  );
});

export const CardsScreen = React.memo(function CardsScreen({
  data,
  refreshing,
  busyKey,
  onRefresh,
  onAction,
  onOpenCard,
  onOpenCatchUp,
}: {
  data: MobileBootstrap;
  refreshing: boolean;
  busyKey: string | null;
  onRefresh: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<string | undefined>;
  onOpenCard: (cardId: string) => void;
  onOpenCatchUp: () => void;
}) {
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
            <SectionCard key={card.id}>
              <CardListItem card={card} today={data.today} onOpenCard={onOpenCard} />
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
    borderRadius: 10,
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
    backgroundColor: COLORS.subtle,
  },
  templateName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
  },
  radioMark: {
    fontSize: 15,
    color: COLORS.ink,
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
    gap: 10,
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
    gap: 6,
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
  footNote: {
    fontSize: 12,
    color: COLORS.faint,
    textAlign: "center",
    marginTop: 4,
  },
});

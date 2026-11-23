import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Badge,
  Button,
  CollapsibleSection,
  FieldInput,
  NUM_STYLE,
  SectionCard,
  useThemedStyles,
  type ThemeColors,
} from "../components/ui";
import {
  checkRedemptionClient,
  formatCents,
  formatCpp,
  formatDate,
  formatInteger,
  formatSignedCents,
} from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type { MobileActionPayload, MobileBootstrap } from "../types";

const PROGRAM_COLORS = [
  "#1e3a8a",
  "#0d9488",
  "#d97706",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#64748b",
] as const;

const PROGRAM_ALIASES: [RegExp, string][] = [
  [/membership rewards|\bmr\b|\bamex\b.*points/i, "American Express Membership Rewards"],
  [/ultimate rewards|\bur\b/i, "Chase Ultimate Rewards"],
  [/capital one|venture/i, "Capital One Venture Rewards"],
  [/thank ?you/i, "Citi ThankYou"],
  [/bilt/i, "Bilt Rewards"],
  [/wells ?fargo/i, "Wells Fargo Rewards"],
  [/hyatt/i, "Hyatt"],
  [/marriott|bonvoy/i, "Marriott Bonvoy"],
  [/hilton/i, "Hilton Honors"],
  [/\bihg\b/i, "IHG One Rewards"],
  [/wyndham/i, "Wyndham"],
  [/choice/i, "Choice Privileges"],
  [/alaska|atmos|hawaiian/i, "Alaska / Hawaiian Atmos Rewards"],
  [/aadvantage|american airlines/i, "American AAdvantage"],
  [/delta|skymiles/i, "Delta SkyMiles"],
  [/united|mileageplus/i, "United MileagePlus"],
  [/southwest/i, "Southwest Rapid Rewards"],
  [/jetblue/i, "JetBlue TrueBlue"],
  [/aeroplan/i, "Aeroplan"],
  [/avios|british airways/i, "British Airways Avios"],
  [/flying blue/i, "Flying Blue"],
  [/lifemiles|avianca/i, "Avianca LifeMiles"],
  [/virgin/i, "Virgin Atlantic"],
  [/\bana\b/i, "ANA Mileage Club"],
  [/krisflyer|singapore/i, "Singapore KrisFlyer"],
  [/asia miles|cathay/i, "Cathay Pacific Asia Miles"],
  [/turkish/i, "Turkish Miles&Smiles"],
  [/emirates/i, "Emirates Skywards"],
  [/etihad/i, "Etihad Guest"],
  [/qatar/i, "Qatar Privilege Club"],
  [/korean/i, "Korean Air SKYPASS"],
  [/amtrak/i, "Amtrak Guest Rewards"],
  [/discover/i, "Discover Cashback"],
  [/cash ?back/i, "Cash back"],
];

function matchProgramOption(
  input: string,
  programs: MobileBootstrap["points"]["programs"],
): MobileBootstrap["points"]["programs"][number] | undefined {
  const trimmed = input.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  const exact = programs.find((p) => p.program.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const canonical = PROGRAM_ALIASES.find(([re]) => re.test(trimmed))?.[1];
  if (!canonical) return undefined;
  return programs.find((p) => p.program === canonical);
}

export const PointsScreen = React.memo(function PointsScreen({
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
  const initialProgram = data.points.programs[0];
  const [panel, setPanel] = useState<"none" | "add" | "paste">("none");
  const [addProgram, setAddProgram] = useState(initialProgram?.program ?? "Chase Ultimate Rewards");
  const [addBalance, setAddBalance] = useState("");
  const [addCpp, setAddCpp] = useState(
    initialProgram ? String(initialProgram.centsPerPoint) : "1.5",
  );
  const [addCppEdited, setAddCppEdited] = useState(false);
  const [pasteBalances, setPasteBalances] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [editCpp, setEditCpp] = useState("");

  // Live "Points or cash?" calculator state
  const [calcProgram, setCalcProgram] = useState(
    data.points.balances[0]?.program ??
      data.points.programs[0]?.program ??
      "Chase Ultimate Rewards",
  );
  const [calcCash, setCalcCash] = useState("");
  const [calcPoints, setCalcPoints] = useState("");
  const [calcFees, setCalcFees] = useState("");
  const [calcNote, setCalcNote] = useState("");

  const matchedAddProgram = useMemo(
    () => matchProgramOption(addProgram, data.points.programs),
    [addProgram, data.points.programs],
  );

  const addPreviewValueCents = useMemo(() => {
    const bal = Math.round(Number(addBalance.replace(/[,\s]/g, "")));
    const cppVal = addCpp.trim()
      ? Number(addCpp.replace(/[¢\s]/g, ""))
      : (matchedAddProgram?.defaultCentsPerPoint ?? 1);
    if (!Number.isFinite(bal) || bal <= 0 || !Number.isFinite(cppVal) || cppVal < 0) return null;
    return Math.round(Math.round((bal * Math.round(cppVal * 100)) / 100) / 100) * 100;
  }, [addBalance, addCpp, matchedAddProgram]);

  const addIsCustom = useMemo(() => {
    if (!matchedAddProgram || !addCpp.trim()) return false;
    const n = Number(addCpp.replace(/[¢\s]/g, ""));
    if (!Number.isFinite(n)) return false;
    return Math.round(n * 100) !== Math.round(matchedAddProgram.defaultCentsPerPoint * 100);
  }, [addCpp, matchedAddProgram]);

  const targetCpp = useMemo(() => {
    const match = data.points.programs.find(
      (p) => p.program.toLowerCase() === calcProgram.trim().toLowerCase(),
    );
    return match?.centsPerPoint ?? 1.5;
  }, [calcProgram, data.points.programs]);

  const liveCheck = useMemo(
    () =>
      checkRedemptionClient({
        cashDollars: calcCash,
        pointsText: calcPoints,
        feesDollars: calcFees,
        valueCentsPerPoint: targetCpp,
      }),
    [calcCash, calcFees, calcPoints, targetCpp],
  );

  function handleAddProgramChange(next: string) {
    setAddProgram(next);
    if (!addCppEdited) {
      const match = matchProgramOption(next, data.points.programs);
      if (match) setAddCpp(String(match.centsPerPoint));
    }
  }

  function handleAddCppChange(next: string) {
    setAddCpp(next);
    const trimmed = next.trim();
    if (!trimmed) {
      setAddCppEdited(false);
      return;
    }
    const n = Number(trimmed.replace(/[¢\s]/g, ""));
    if (
      matchedAddProgram &&
      Number.isFinite(n) &&
      Math.round(n * 100) === Math.round(matchedAddProgram.defaultCentsPerPoint * 100)
    ) {
      setAddCppEdited(false);
    } else {
      setAddCppEdited(true);
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
          <Text style={styles.title}>Points</Text>
          <Text style={[styles.subtitle, NUM_STYLE]}>
            {formatInteger(data.points.totalPoints)} pts · worth{" "}
            {formatCents(data.points.totalValueCents)}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Button
            label={panel === "add" ? "Close" : "Add balance"}
            size="sm"
            variant={panel === "add" ? "secondary" : "primary"}
            onPress={() => setPanel(panel === "add" ? "none" : "add")}
          />
          <Button
            label={panel === "paste" ? "Close" : "Paste list"}
            size="sm"
            variant="secondary"
            onPress={() => setPanel(panel === "paste" ? "none" : "paste")}
          />
        </View>
      </View>

      {panel === "add" ? (
        <SectionCard style={styles.panelGap}>
          <FieldInput
            label="Program"
            value={addProgram}
            onChangeText={handleAddProgramChange}
            placeholder="Chase Ultimate Rewards, Hyatt, Amex MR..."
          />
          <View style={styles.pillRow}>
            {data.points.programs.slice(0, 6).map((p) => (
              <Pressable
                key={p.program}
                onPress={() => {
                  tapHaptic();
                  setAddProgram(p.program);
                  setAddCpp(String(p.centsPerPoint));
                  setAddCppEdited(false);
                }}
                style={[styles.programPill, addProgram === p.program && styles.programPillActive]}
              >
                <Text
                  style={[
                    styles.programPillText,
                    addProgram === p.program && styles.programPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {p.program}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.twoCol}>
            <View style={styles.flexShrink}>
              <FieldInput
                label="Points balance"
                value={addBalance}
                onChangeText={setAddBalance}
                placeholder="85,000"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flexShrink}>
              <FieldInput
                label="Value (¢/pt, auto)"
                value={addCpp}
                onChangeText={handleAddCppChange}
                placeholder={
                  matchedAddProgram ? String(matchedAddProgram.defaultCentsPerPoint) : "1.5"
                }
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {matchedAddProgram || addPreviewValueCents !== null ? (
            <View style={styles.headerRow}>
              <Text style={[styles.noteText, NUM_STYLE, styles.flexShrink]}>
                {matchedAddProgram
                  ? `${data.points.valuationSource.name} est.: ${formatCpp(matchedAddProgram.defaultCentsPerPoint)}/pt`
                  : ""}
                {matchedAddProgram && addPreviewValueCents !== null ? " · " : ""}
                {addPreviewValueCents !== null ? `Est. ${formatCents(addPreviewValueCents)}` : ""}
              </Text>
              {addIsCustom && matchedAddProgram ? (
                <Button
                  label={`Use auto (${formatCpp(matchedAddProgram.defaultCentsPerPoint)})`}
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    tapHaptic();
                    setAddCpp(String(matchedAddProgram.defaultCentsPerPoint));
                    setAddCppEdited(false);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          <Button
            label="Save balance"
            loading={busyKey === "points.save:new"}
            onPress={() =>
              void onAction(
                {
                  type: "points.save",
                  program: addProgram,
                  balance: addBalance,
                  cpp: addCpp || undefined,
                },
                "points.save:new",
              ).then(() => {
                setAddBalance("");
                setAddCppEdited(false);
                setPanel("none");
              })
            }
          />
        </SectionCard>
      ) : null}

      {panel === "paste" ? (
        <SectionCard style={styles.panelGap}>
          <FieldInput
            label="Paste balances (one program per line)"
            value={pasteBalances}
            onChangeText={setPasteBalances}
            multiline
            placeholder={"Amex MR, 270520\nChase UR, 145000\nHyatt, 62000"}
          />
          <Button
            label="Import balances"
            loading={busyKey === "points.import"}
            onPress={() =>
              void onAction(
                { type: "points.importBalances", balances: pasteBalances },
                "points.import",
              ).then(() => {
                setPasteBalances("");
                setPanel("none");
              })
            }
          />
        </SectionCard>
      ) : null}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        {data.points.balances.length === 0 ? (
          <SectionCard>
            <Text style={styles.noteText}>
              Add your airline, hotel, and transferable point balances to see what they are worth
              using {data.points.valuationSource.label}.
            </Text>
          </SectionCard>
        ) : (
          <SectionCard style={styles.divideList}>
            {data.points.totalValueCents > 0 ? (
              <View style={styles.portfolioHeader}>
                <View style={styles.portfolioTopRow}>
                  <View>
                    <Text style={styles.portfolioEyebrow}>PORTFOLIO VALUE</Text>
                    <Text style={styles.metaText}>{data.points.valuationSource.label}</Text>
                  </View>
                  <Text style={[styles.portfolioTotal, NUM_STYLE]}>
                    {formatCents(data.points.totalValueCents)}
                  </Text>
                </View>
                <View style={styles.stackedBar}>
                  {data.points.balances.map((b, idx) => {
                    const flex = Math.max(0, b.valueCents);
                    if (flex === 0) return null;
                    return (
                      <View
                        key={b.id}
                        style={[
                          styles.stackedSegment,
                          {
                            flex,
                            backgroundColor: PROGRAM_COLORS[idx % PROGRAM_COLORS.length],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
            {data.points.balances.map((b, idx) => {
              const isEditing = editingId === b.id;
              return (
                <View
                  key={b.id}
                  style={[
                    styles.balanceBlock,
                    (idx > 0 || data.points.totalValueCents > 0) && styles.rowDivider,
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      tapHaptic();
                      if (isEditing) {
                        setEditingId(null);
                      } else {
                        setEditingId(b.id);
                        setEditBalance(String(b.balance));
                        setEditCpp(String(b.centsPerPointX100 / 100));
                      }
                    }}
                    style={styles.balanceRow}
                  >
                    <View style={styles.programRowLeft}>
                      <View
                        style={[
                          styles.programDot,
                          { backgroundColor: PROGRAM_COLORS[idx % PROGRAM_COLORS.length] },
                        ]}
                      />
                      <View style={styles.flexShrink}>
                        <Text style={styles.programTitle}>{b.program}</Text>
                        <Text style={[styles.metaText, NUM_STYLE]}>
                          {formatInteger(b.balance)} pts at {formatCpp(b.centsPerPointX100 / 100)}
                          {b.customValue ? " (custom)" : ""}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.valueTitle, NUM_STYLE]}>{formatCents(b.valueCents)}</Text>
                  </Pressable>

                  {isEditing ? (
                    <View style={styles.editArea}>
                      <View style={styles.twoCol}>
                        <View style={styles.flexShrink}>
                          <FieldInput
                            label="Balance"
                            value={editBalance}
                            onChangeText={setEditBalance}
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={styles.flexShrink}>
                          <FieldInput
                            label="¢ per point"
                            value={editCpp}
                            onChangeText={setEditCpp}
                            placeholder={String(b.defaultCentsPerPointX100 / 100)}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                      <View style={styles.buttonRow}>
                        <Button
                          label="Save"
                          size="sm"
                          loading={busyKey === `points.save:${b.id}`}
                          onPress={() =>
                            void onAction(
                              {
                                type: "points.save",
                                program: b.program,
                                balance: editBalance,
                                cpp: editCpp || undefined,
                              },
                              `points.save:${b.id}`,
                            ).then(() => setEditingId(null))
                          }
                        />
                        {b.customValue ? (
                          <Button
                            label={`Reset to auto (${formatCpp(b.defaultCentsPerPointX100 / 100)})`}
                            size="sm"
                            variant="secondary"
                            loading={busyKey === `points.reset:${b.id}`}
                            onPress={() =>
                              void onAction(
                                {
                                  type: "points.save",
                                  program: b.program,
                                  balance: editBalance,
                                  cpp: undefined,
                                },
                                `points.reset:${b.id}`,
                              ).then(() => setEditingId(null))
                            }
                          />
                        ) : null}
                        <Button
                          label="Delete"
                          size="sm"
                          variant="danger"
                          loading={busyKey === `points.del:${b.id}`}
                          onPress={() =>
                            void onAction(
                              { type: "points.delete", id: b.id },
                              `points.del:${b.id}`,
                            ).then(() => setEditingId(null))
                          }
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </SectionCard>
        )}
      </View>

      <SectionCard style={styles.panelGap}>
        <Text style={styles.sectionTitle}>Points or cash?</Text>
        <Text style={styles.noteText}>
          Compare an award booking against your usual {formatCpp(targetCpp)} valuation.
        </Text>

        {data.points.balances.length > 0 ? (
          <View style={styles.pillRow}>
            {data.points.balances.map((b) => {
              const active = calcProgram === b.program;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    tapHaptic();
                    setCalcProgram(b.program);
                  }}
                  style={[styles.programPill, active && styles.programPillActive]}
                >
                  <Text
                    style={[styles.programPillText, active && styles.programPillTextActive]}
                    numberOfLines={1}
                  >
                    {b.program}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <FieldInput
            label="Program"
            value={calcProgram}
            onChangeText={setCalcProgram}
            placeholder="Hyatt"
          />
        )}

        <View style={styles.twoCol}>
          <View style={styles.flexShrink}>
            <FieldInput
              label="Cash price ($)"
              value={calcCash}
              onChangeText={setCalcCash}
              placeholder="480"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.flexShrink}>
            <FieldInput
              label="Points needed"
              value={calcPoints}
              onChangeText={setCalcPoints}
              placeholder="20,000"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.flexShrink}>
            <FieldInput
              label="Award fees ($)"
              value={calcFees}
              onChangeText={setCalcFees}
              placeholder="5.60"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.flexShrink}>
            <FieldInput
              label="Note (optional)"
              value={calcNote}
              onChangeText={setCalcNote}
              placeholder="SFO-JFK"
            />
          </View>
        </View>

        {liveCheck ? (
          <View style={styles.verdictBox}>
            <View style={styles.verdictHeader}>
              <Badge
                label={
                  liveCheck.verdict === "points"
                    ? "Use points"
                    : liveCheck.verdict === "cash"
                      ? "Pay cash"
                      : "About even"
                }
                tone={
                  liveCheck.verdict === "points"
                    ? "green"
                    : liveCheck.verdict === "cash"
                      ? "amber"
                      : "neutral"
                }
              />
              <Text style={[styles.verdictCpp, NUM_STYLE]}>
                {formatCpp(liveCheck.centsPerPoint)} per point
              </Text>
            </View>
            <Text style={[styles.noteText, NUM_STYLE]}>
              {liveCheck.gainCents >= 0
                ? `${formatSignedCents(liveCheck.gainCents)} ahead of your usual ${formatCpp(targetCpp)} value.`
                : `${formatCents(Math.abs(liveCheck.gainCents))} below what you normally value those points at.`}
            </Text>
            <Button
              label="Log as a redemption I made"
              size="sm"
              variant="secondary"
              loading={busyKey === "redemption.add"}
              onPress={() =>
                void onAction(
                  {
                    type: "redemption.add",
                    program: calcProgram,
                    points: calcPoints,
                    cash: calcCash,
                    fees: calcFees || "0",
                    note: calcNote,
                  },
                  "redemption.add",
                ).then(() => {
                  setCalcCash("");
                  setCalcPoints("");
                  setCalcFees("");
                  setCalcNote("");
                })
              }
            />
          </View>
        ) : null}
      </SectionCard>

      {data.points.redemptions.length > 0 ? (
        <CollapsibleSection
          title="Past redemptions"
          countLabel={`${data.points.redemptions.length}`}
        >
          {() =>
            data.points.redemptions.map((r, idx) => (
              <View key={r.id} style={[styles.redemptionRow, idx > 0 && styles.rowDivider]}>
                <View style={styles.flexShrink}>
                  <Text style={styles.programTitle}>
                    {r.program}
                    {r.note ? ` · ${r.note}` : ""}
                  </Text>
                  <Text style={[styles.metaText, NUM_STYLE]}>
                    {formatInteger(r.points)} pts vs {formatCents(r.cashCents)} cash (
                    {formatCpp(r.centsPerPoint)}) · {formatDate(r.redeemedOn, data.today)}
                  </Text>
                </View>
                <Button
                  label="Delete"
                  size="sm"
                  variant="ghost"
                  loading={busyKey === `red.del:${r.id}`}
                  onPress={() =>
                    void onAction({ type: "redemption.delete", id: r.id }, `red.del:${r.id}`)
                  }
                />
              </View>
            ))
          }
        </CollapsibleSection>
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
      gap: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
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
    buttonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    panelGap: {
      gap: 10,
    },
    twoCol: {
      flexDirection: "row",
      gap: 10,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    programPill: {
      minHeight: 34,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.borderStrong,
      backgroundColor: COLORS.card,
      justifyContent: "center",
    },
    programPillActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    programPillText: {
      fontSize: 12,
      fontWeight: "600",
      color: COLORS.ink,
      maxWidth: 210,
    },
    programPillTextActive: {
      color: COLORS.primaryInk,
    },
    sectionBlock: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    noteText: {
      fontSize: 13,
      lineHeight: 18,
      color: COLORS.muted,
    },
    divideList: {
      paddingVertical: 6,
    },
    portfolioHeader: {
      paddingVertical: 10,
      gap: 8,
    },
    portfolioTopRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    portfolioEyebrow: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.7,
      color: COLORS.muted,
    },
    portfolioTotal: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.ink,
    },
    stackedBar: {
      flexDirection: "row",
      height: 8,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: COLORS.subtle,
      gap: 2,
    },
    stackedSegment: {
      height: "100%",
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    balanceBlock: {
      paddingVertical: 10,
      gap: 10,
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    programRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      flex: 1,
    },
    programDot: {
      width: 9,
      height: 9,
      borderRadius: 99,
      flexShrink: 0,
    },
    programTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: COLORS.ink,
    },
    metaText: {
      fontSize: 12,
      color: COLORS.muted,
      marginTop: 2,
    },
    valueTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: COLORS.ink,
    },
    editArea: {
      gap: 10,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    verdictBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: 12,
      gap: 8,
    },
    verdictHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    verdictCpp: {
      fontSize: 14,
      fontWeight: "700",
      color: COLORS.ink,
    },
    redemptionRow: {
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
  });

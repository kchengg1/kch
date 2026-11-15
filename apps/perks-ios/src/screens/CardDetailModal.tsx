import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import {
  CADENCE_OPTIONS,
  centsToInputDollars,
  formatCents,
  formatDate,
  formatSignedCents,
} from "../lib/format";
import { tapHaptic } from "../lib/haptics";
import type {
  Cadence,
  CatalogEntry,
  MobileActionPayload,
  MobileBenefit,
  MobileCard,
} from "../types";

function BenefitEditorForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: MobileBenefit;
  busy: boolean;
  submitLabel: string;
  onSubmit: (values: {
    name: string;
    cadence: Cadence;
    amount: string;
    notes: string;
    enrollRequired: boolean;
    endsOn: string;
  }) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "monthly");
  const [amount, setAmount] = useState(
    initial && initial.amountCents > 0 ? centsToInputDollars(initial.amountCents) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [enrollRequired, setEnrollRequired] = useState(initial?.enrollRequired ?? false);
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "");

  return (
    <View style={styles.formStack}>
      <FieldInput
        label="Benefit name"
        value={name}
        onChangeText={setName}
        placeholder="Uber Cash"
      />

      <View style={styles.fieldGap}>
        <Text style={styles.smallLabel}>Resets</Text>
        <View style={styles.pillWrap}>
          {CADENCE_OPTIONS.map((opt) => {
            const selected = opt.value === cadence;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  tapHaptic();
                  setCadence(opt.value);
                }}
                style={[styles.cadencePill, selected && styles.cadencePillActive]}
              >
                <Text style={[styles.cadenceText, selected && styles.cadenceTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {cadence !== "perk" ? (
        <FieldInput
          label="Amount per reset ($)"
          value={amount}
          onChangeText={setAmount}
          placeholder="15"
          keyboardType="decimal-pad"
        />
      ) : null}

      <FieldInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Use in the Uber app before month-end"
      />

      <FieldInput
        label="Ends on (optional)"
        value={endsOn}
        onChangeText={setEndsOn}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Requires enrollment</Text>
        <Switch value={enrollRequired} onValueChange={setEnrollRequired} />
      </View>

      <View style={styles.actionRow}>
        <Button
          label={submitLabel}
          size="sm"
          loading={busy}
          onPress={() =>
            void onSubmit({
              name,
              cadence,
              amount: cadence === "perk" ? "0" : amount || "0",
              notes,
              enrollRequired,
              endsOn,
            })
          }
        />
        {onCancel ? (
          <Button label="Cancel" size="sm" variant="secondary" onPress={onCancel} />
        ) : null}
        {onDelete ? <Button label="Delete" size="sm" variant="danger" onPress={onDelete} /> : null}
      </View>
    </View>
  );
}

function BenefitCardBlock({
  benefit,
  busyKey,
  onAction,
}: {
  benefit: MobileBenefit;
  busyKey: string | null;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [partialChipKey, setPartialChipKey] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");

  const currentChip = benefit.periods.find((p) => p.current);

  return (
    <View style={[styles.benefitBlock, !benefit.tracked && styles.untrackedOpacity]}>
      <View style={styles.benefitTopRow}>
        <View style={styles.flexShrink}>
          <Text style={styles.benefitName}>{benefit.name}</Text>
          <Text style={[styles.benefitMeta, NUM_STYLE]}>
            {benefit.amountCents > 0 ? `${formatCents(benefit.amountCents)} · ` : ""}
            {benefit.cadenceLabel}
            {benefit.inApp && benefit.cadence !== "perk" ? " · In-app" : ""}
          </Text>
        </View>
        <Button
          label={editing ? "Done" : "Edit"}
          size="sm"
          variant="ghost"
          onPress={() => setEditing((v) => !v)}
        />
      </View>

      {benefit.notes ? <Text style={styles.noteText}>{benefit.notes}</Text> : null}

      <View style={styles.badgeWrap}>
        {!benefit.tracked ? <Badge label="Paused" tone="neutral" /> : null}
        {benefit.expired ? <Badge label="Ended" tone="neutral" /> : null}
        {benefit.enrollRequired ? (
          <Pressable
            onPress={() =>
              void onAction(
                {
                  type: "benefit.setFlag",
                  id: benefit.id,
                  flag: "enrolled",
                  value: !benefit.enrolled,
                },
                `flag:enrolled:${benefit.id}`,
              )
            }
          >
            <Badge
              label={benefit.enrolled ? "✓ Enrolled" : "Tap when enrolled"}
              tone={benefit.enrolled ? "green" : "amber"}
            />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() =>
            void onAction(
              {
                type: "benefit.setFlag",
                id: benefit.id,
                flag: "tracked",
                value: !benefit.tracked,
              },
              `flag:tracked:${benefit.id}`,
            )
          }
        >
          <Badge label={benefit.tracked ? "Tracking" : "Not tracking"} tone="neutral" />
        </Pressable>
      </View>

      {benefit.cadence !== "perk" && benefit.periods.length > 0 ? (
        <View style={styles.chipsSection}>
          <View style={styles.chipGrid}>
            {benefit.periods.map((chip) => {
              const key = `${benefit.id}:${chip.key}`;
              const isBusy = busyKey === key;
              return (
                <Pressable
                  key={chip.key}
                  disabled={chip.future || isBusy}
                  onPress={() => {
                    tapHaptic();
                    const nextPayload: MobileActionPayload = chip.full
                      ? { type: "usage.clearUsed", benefitId: benefit.id, periodKey: chip.key }
                      : { type: "usage.markUsed", benefitId: benefit.id, periodKey: chip.key };
                    void onAction(nextPayload, key);
                  }}
                  style={[
                    styles.periodChip,
                    chip.current && styles.periodChipCurrent,
                    chip.full && styles.periodChipFull,
                    chip.partial && styles.periodChipPartial,
                    chip.future && styles.periodChipFuture,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodChipText,
                      chip.full && styles.periodChipTextFull,
                      chip.partial && styles.periodChipTextPartial,
                    ]}
                  >
                    {chip.full ? "✓ " : ""}
                    {chip.shortLabel}
                    {chip.partial ? ` (${formatCents(chip.usedCents)})` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.chipFootActions}>
            {currentChip && benefit.amountCents > 0 ? (
              <Button
                label={partialChipKey === currentChip.key ? "Cancel partial" : "Log partial $"}
                size="sm"
                variant="secondary"
                onPress={() => {
                  if (partialChipKey === currentChip.key) {
                    setPartialChipKey(null);
                  } else {
                    setPartialChipKey(currentChip.key);
                    setPartialAmount(
                      currentChip.usedCents > 0 ? centsToInputDollars(currentChip.usedCents) : "",
                    );
                  }
                }}
              />
            ) : null}
            {benefit.openPastCount > 0 ? (
              <Button
                label={`Mark ${benefit.openPastCount} earlier used`}
                size="sm"
                variant="secondary"
                loading={busyKey === `past:${benefit.id}`}
                onPress={() =>
                  void onAction(
                    { type: "usage.markPastUsed", benefitId: benefit.id },
                    `past:${benefit.id}`,
                  )
                }
              />
            ) : null}
          </View>

          {partialChipKey ? (
            <View style={styles.inlineRow}>
              <TextInput
                value={partialAmount}
                onChangeText={setPartialAmount}
                placeholder="Used amount ($)"
                placeholderTextColor={COLORS.faint}
                keyboardType="decimal-pad"
                style={styles.inlineInput}
              />
              <Button
                label="Save"
                size="sm"
                loading={busyKey === `part:${benefit.id}:${partialChipKey}`}
                onPress={() =>
                  void onAction(
                    {
                      type: "usage.logAmount",
                      benefitId: benefit.id,
                      periodKey: partialChipKey,
                      amount: partialAmount || "0",
                    },
                    `part:${benefit.id}:${partialChipKey}`,
                  ).then(() => setPartialChipKey(null))
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {editing ? (
        <View style={styles.editDrawer}>
          <BenefitEditorForm
            initial={benefit}
            busy={busyKey === `benefit.update:${benefit.id}`}
            submitLabel="Save benefit"
            onCancel={() => setEditing(false)}
            onDelete={() => {
              Alert.alert("Delete benefit?", `Remove "${benefit.name}" from this card?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    void onAction(
                      { type: "benefit.delete", id: benefit.id },
                      `benefit.delete:${benefit.id}`,
                    ),
                },
              ]);
            }}
            onSubmit={async (values) => {
              await onAction(
                { type: "benefit.update", id: benefit.id, ...values },
                `benefit.update:${benefit.id}`,
              );
              setEditing(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export function CardDetailModal({
  card,
  today,
  catalog,
  busyKey,
  onClose,
  onAction,
}: {
  card: MobileCard | null;
  today: string;
  catalog: CatalogEntry[];
  busyKey: string | null;
  onClose: () => void;
  onAction: (payload: MobileActionPayload, key: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();

  const [worthDrafts, setWorthDrafts] = useState<Record<string, string>>({});
  const [bonusText, setBonusText] = useState("");
  const [msrDollars, setMsrDollars] = useState("");
  const [msrDeadline, setMsrDeadline] = useState("");
  const [msrSpent, setMsrSpent] = useState("");
  const [bonusReceived, setBonusReceived] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardIssuer, setCardIssuer] = useState("");
  const [cardFee, setCardFee] = useState("");
  const [cardOpened, setCardOpened] = useState("");
  const [cardBusiness, setCardBusiness] = useState(false);
  const [cardClosed, setCardClosed] = useState(false);

  useEffect(() => {
    if (!card) return;
    const nextWorth: Record<string, string> = {};
    for (const b of card.benefits) {
      if (b.myValueCents !== null) {
        nextWorth[b.id] = centsToInputDollars(b.myValueCents);
      }
    }
    setWorthDrafts(nextWorth);
    setBonusText(card.bonusText);
    setMsrDollars(card.msrCents ? centsToInputDollars(card.msrCents) : "");
    setMsrDeadline(card.msrDeadline ?? "");
    setMsrSpent(centsToInputDollars(card.msrSpentCents));
    setBonusReceived(card.bonusReceivedOn ?? "");

    setCardName(card.name);
    setCardIssuer(card.issuer);
    setCardFee(centsToInputDollars(card.annualFeeCents));
    setCardOpened(card.openedOn ?? "");
    setCardBusiness(card.business);
    setCardClosed(card.closed);
  }, [card]);

  if (!card) return null;

  const credits = card.benefits.filter((b) => b.cadence !== "perk");
  const perks = card.benefits.filter((b) => b.cadence === "perk");
  const matchingCatalog = card.templateKey
    ? catalog.find((t) => t.key === card.templateKey)
    : undefined;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modalRoot, { paddingTop: Platform.OS === "android" ? insets.top : 8 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.topIdentity}>
            <CardSwatch style={card.style} size="md" />
            <View style={styles.flexShrink}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {card.name}
              </Text>
              <Text style={[styles.modalSub, NUM_STYLE]}>
                {card.annualFeeCents > 0 ? `${formatCents(card.annualFeeCents)}/yr` : "No fee"}
                {card.nextFeeOn ? ` · Renews ${formatDate(card.nextFeeOn, today)}` : ""}
              </Text>
            </View>
          </View>
          <Button label="Done" size="sm" variant="secondary" onPress={onClose} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <SectionCard style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Used so far</Text>
              <Text style={[styles.summaryNumber, NUM_STYLE]}>
                {formatCents(card.capturedCents)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Available / yr</Text>
              <Text style={[styles.summaryNumber, NUM_STYLE]}>
                {formatCents(card.availableCents)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net worth / yr</Text>
              <Text
                style={[
                  styles.summaryNumber,
                  NUM_STYLE,
                  { color: card.worth.netCents >= 0 ? COLORS.greenInk : COLORS.redInk },
                ]}
              >
                {formatSignedCents(card.worth.netCents)}
              </Text>
            </View>
          </SectionCard>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Credits ({credits.length})</Text>
            {credits.length === 0 ? (
              <SectionCard>
                <Text style={styles.noteText}>
                  No credits listed yet. Open Add a benefit below to add one.
                </Text>
              </SectionCard>
            ) : (
              <SectionCard style={styles.divideList}>
                {credits.map((b, idx) => (
                  <View key={b.id} style={idx > 0 ? styles.rowDivider : undefined}>
                    <BenefitCardBlock benefit={b} busyKey={busyKey} onAction={onAction} />
                  </View>
                ))}
              </SectionCard>
            )}
          </View>

          {perks.length > 0 ? (
            <CollapsibleSection title="Ongoing perks" countLabel={`${perks.length}`}>
              {perks.map((b, idx) => (
                <View key={b.id} style={idx > 0 ? styles.rowDivider : undefined}>
                  <BenefitCardBlock benefit={b} busyKey={busyKey} onAction={onAction} />
                </View>
              ))}
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection title="Add a benefit">
            <BenefitEditorForm
              busy={busyKey === `benefit.add:${card.id}`}
              submitLabel="Add benefit"
              onSubmit={async (values) => {
                await onAction(
                  { type: "benefit.add", cardId: card.id, ...values },
                  `benefit.add:${card.id}`,
                );
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Is it worth the fee?"
            countLabel={`${formatSignedCents(card.worth.netCents)}/yr`}
          >
            <Text style={styles.noteText}>
              Advertised credits total {formatCents(card.worth.advertisedCents)}/yr. Enter what each
              benefit is honestly worth to you per year (leave blank for face value).
            </Text>
            {card.benefits
              .filter((b) => b.tracked && !b.expired)
              .map((b) => (
                <View key={b.id} style={styles.worthRow}>
                  <View style={styles.flexShrink}>
                    <Text style={styles.worthName}>{b.name}</Text>
                    <Text style={[styles.benefitMeta, NUM_STYLE]}>
                      Face: {formatCents(b.faceYearlyCents)}/yr
                    </Text>
                  </View>
                  <TextInput
                    value={worthDrafts[b.id] ?? ""}
                    onChangeText={(val) => setWorthDrafts((prev) => ({ ...prev, [b.id]: val }))}
                    placeholder={centsToInputDollars(b.faceYearlyCents)}
                    placeholderTextColor={COLORS.faint}
                    keyboardType="decimal-pad"
                    style={styles.worthInput}
                  />
                </View>
              ))}
            <Button
              label="Save my values"
              size="sm"
              loading={busyKey === `worth.save:${card.id}`}
              onPress={() => {
                const payloadValues: Record<string, string> = {};
                for (const b of card.benefits) {
                  payloadValues[b.id] = worthDrafts[b.id] ?? "";
                }
                void onAction(
                  { type: "worth.save", cardId: card.id, values: payloadValues },
                  `worth.save:${card.id}`,
                );
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Sign-up bonus & minimum spend"
            countLabel={
              card.msr
                ? card.msr.state === "received"
                  ? "Received"
                  : card.msr.state === "met"
                    ? "Met"
                    : `${formatCents(card.msr.leftCents)} left`
                : undefined
            }
          >
            {card.msr ? (
              <Meter
                value={card.msr.spentCents}
                max={card.msr.requiredCents}
                tone={card.msr.state === "met" || card.msr.state === "received" ? "green" : "dark"}
              />
            ) : null}
            <FieldInput
              label="Headline bonus"
              value={bonusText}
              onChangeText={setBonusText}
              placeholder="100,000 points"
            />
            <View style={styles.twoCol}>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Required spend ($)"
                  value={msrDollars}
                  onChangeText={setMsrDollars}
                  placeholder="6000"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Spent so far ($)"
                  value={msrSpent}
                  onChangeText={setMsrSpent}
                  placeholder="1250"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Spend deadline"
                  value={msrDeadline}
                  onChangeText={setMsrDeadline}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Bonus received date"
                  value={bonusReceived}
                  onChangeText={setBonusReceived}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Button
              label="Save bonus details"
              size="sm"
              loading={busyKey === `bonus.update:${card.id}`}
              onPress={() =>
                void onAction(
                  {
                    type: "bonus.update",
                    cardId: card.id,
                    bonus: bonusText,
                    msr: msrDollars,
                    deadline: msrDeadline,
                    spent: msrSpent || "0",
                    received: bonusReceived,
                  },
                  `bonus.update:${card.id}`,
                )
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Card details & status">
            <FieldInput label="Card name" value={cardName} onChangeText={setCardName} />
            <FieldInput label="Issuer" value={cardIssuer} onChangeText={setCardIssuer} />
            <View style={styles.twoCol}>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Annual fee ($)"
                  value={cardFee}
                  onChangeText={setCardFee}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flexShrink}>
                <FieldInput
                  label="Opened date"
                  value={cardOpened}
                  onChangeText={setCardOpened}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Business card</Text>
              <Switch value={cardBusiness} onValueChange={setCardBusiness} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Closed account</Text>
              <Switch value={cardClosed} onValueChange={setCardClosed} />
            </View>

            <View style={styles.actionRow}>
              <Button
                label="Save card"
                size="sm"
                loading={busyKey === `card.update:${card.id}`}
                onPress={() =>
                  void onAction(
                    {
                      type: "card.update",
                      id: card.id,
                      name: cardName,
                      issuer: cardIssuer,
                      annualFee: cardFee || "0",
                      openedOn: cardOpened,
                      business: cardBusiness,
                      closed: cardClosed,
                    },
                    `card.update:${card.id}`,
                  )
                }
              />
              {matchingCatalog ? (
                <Button
                  label="Sync built-in benefits"
                  size="sm"
                  variant="secondary"
                  loading={busyKey === `card.template:${card.id}`}
                  onPress={() =>
                    void onAction(
                      {
                        type: "card.applyTemplate",
                        id: card.id,
                        template: matchingCatalog.key,
                      },
                      `card.template:${card.id}`,
                    )
                  }
                />
              ) : null}
              <Button
                label="Delete card"
                size="sm"
                variant="danger"
                loading={busyKey === `card.delete:${card.id}`}
                onPress={() => {
                  Alert.alert("Delete card?", `Delete ${card.name} and all its logged usage?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void onAction(
                          { type: "card.delete", id: card.id },
                          `card.delete:${card.id}`,
                        ).then(onClose),
                    },
                  ]);
                }}
              />
            </View>
          </CollapsibleSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  topIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  flexShrink: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 1,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  summaryStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "500",
  },
  summaryNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
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
  benefitBlock: {
    paddingVertical: 10,
    gap: 8,
  },
  untrackedOpacity: {
    opacity: 0.65,
  },
  benefitTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  benefitName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.ink,
  },
  benefitMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 1,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipsSection: {
    gap: 8,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  periodChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  periodChipCurrent: {
    borderColor: COLORS.ink,
    borderWidth: 1.5,
  },
  periodChipFull: {
    backgroundColor: COLORS.greenBg,
    borderColor: COLORS.greenBorder,
  },
  periodChipPartial: {
    backgroundColor: COLORS.amberBg,
    borderColor: COLORS.amberBorder,
  },
  periodChipFuture: {
    opacity: 0.45,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
    fontVariant: ["tabular-nums"],
  },
  periodChipTextFull: {
    color: COLORS.greenInk,
  },
  periodChipTextPartial: {
    color: COLORS.amberInk,
  },
  chipFootActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineRow: {
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
  editDrawer: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  formStack: {
    gap: 10,
  },
  fieldGap: {
    gap: 6,
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.muted,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cadencePill: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    justifyContent: "center",
  },
  cadencePillActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  cadenceText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.ink,
  },
  cadenceTextActive: {
    color: "#ffffff",
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  worthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  worthName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
  },
  worthInput: {
    width: 92,
    minHeight: 40,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    textAlign: "right",
    color: COLORS.ink,
    backgroundColor: COLORS.bg,
    fontVariant: ["tabular-nums"],
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
});

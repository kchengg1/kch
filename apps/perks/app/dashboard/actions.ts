"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  and,
  db,
  eq,
  perksBenefit,
  perksCard,
  perksHiddenMerchant,
  perksPoints,
  perksPushSubscription,
  perksReferral,
  perksSpendTarget,
  perksRedemption,
  perksOffer,
  perksSettings,
  perksUsage,
  inArray,
} from "@kch/db";
import { getTemplate } from "@/lib/catalog";
import { catalogUpdates, templateRow } from "@/lib/catalog-sync";
import { sendDigest } from "@/lib/digest";
import { sendPush } from "@/lib/push";
import { parseDollars } from "@/lib/money";
import { merchantKey } from "@/lib/offer-groups";
import { defaultCentsPerPoint, normalizeProgram, parseBalances } from "@/lib/points";
import { offerKey, type ParsedOffer } from "@/lib/offer-parse";
import {
  addTemplateBenefits,
  getBenefit,
  getCard,
  listHiddenMerchants,
  listOffers,
  listPoints,
  loadPortfolio,
  today,
  otherUserIds,
} from "@/lib/perks";
import { currentPeriod, isCadence, periodsThisYear } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { parseCardSheet, parseSheetDate } from "@/lib/sheet-import";

export type FormState = { error?: string; message?: string } | undefined;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const refresh = () => revalidatePath("/dashboard", "layout");

/* ---- Usage ------------------------------------------------------------- */

/** A benefit the caller owns, plus the period the key refers to. */
async function ownedPeriod(benefitId: string, periodKey: string) {
  const { user } = await requireSession();
  const benefit = await getBenefit(benefitId, user.id);
  if (!benefit || !isCadence(benefit.cadence)) return null;
  const card = await getCard(benefit.cardId, user.id);
  if (!card) return null;
  const now = today();
  const valid = [
    ...periodsThisYear(benefit.cadence, now, card.openedOn),
    currentPeriod(benefit.cadence, now, card.openedOn),
  ].some((p) => p?.key === periodKey);
  return valid ? { user, benefit } : null;
}

async function setUsage(benefitId: string, userId: string, periodKey: string, usedCents: number) {
  await db
    .insert(perksUsage)
    .values({ id: crypto.randomUUID(), benefitId, userId, periodKey, usedCents })
    .onConflictDoUpdate({
      target: [perksUsage.benefitId, perksUsage.periodKey],
      set: { usedCents, updatedAt: new Date() },
    });
}

export async function markUsedAction(benefitId: string, periodKey: string) {
  const owned = await ownedPeriod(benefitId, periodKey);
  if (!owned) return;
  await setUsage(benefitId, owned.user.id, periodKey, owned.benefit.amountCents);
  refresh();
}

export async function clearUsedAction(benefitId: string, periodKey: string) {
  const owned = await ownedPeriod(benefitId, periodKey);
  if (!owned) return;
  await db
    .delete(perksUsage)
    .where(and(eq(perksUsage.benefitId, benefitId), eq(perksUsage.periodKey, periodKey)));
  refresh();
}

/** Mark every earlier period of this year used, keeping any amounts already logged. */
export async function markPastUsedAction(benefitId: string) {
  const { user } = await requireSession();
  const benefit = await getBenefit(benefitId, user.id);
  if (!benefit || !isCadence(benefit.cadence) || benefit.amountCents === 0) return;
  const card = await getCard(benefit.cardId, user.id);
  if (!card) return;
  const now = today();
  const past = periodsThisYear(benefit.cadence, now, card.openedOn).filter((p) => p.end < now);
  if (past.length === 0) return;
  await db
    .insert(perksUsage)
    .values(
      past.map((p) => ({
        id: crypto.randomUUID(),
        benefitId,
        userId: user.id,
        periodKey: p.key,
        usedCents: benefit.amountCents,
      })),
    )
    .onConflictDoNothing({ target: [perksUsage.benefitId, perksUsage.periodKey] });
  refresh();
}

/**
 * Save statement credits the owner matched to benefits. Each credit counts
 * toward the period its date falls in. Re-importing the same file is safe:
 * a period keeps the larger of what was logged and what the file shows.
 */
export async function saveStatementCreditsAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { user } = await requireSession();
  const card = await getCard(text(form, "cardId"), user.id);
  if (!card) return { error: "Pick the card this statement is for." };

  let rows: { date: unknown; amountCents: unknown; benefitId: unknown }[];
  try {
    rows = JSON.parse(text(form, "credits"));
    if (!Array.isArray(rows)) throw new Error();
  } catch {
    return { error: "Could not read the matched credits. Upload the file again." };
  }

  const { benefits, usage } = await loadPortfolio(user.id);
  const cardBenefits = new Map(benefits.filter((b) => b.cardId === card.id).map((b) => [b.id, b]));
  const existing = new Map(usage.map((u) => [`${u.benefitId}|${u.periodKey}`, u.usedCents]));
  const now = today();
  const totals = new Map<
    string,
    { benefitId: string; periodKey: string; cents: number; cap: number }
  >();
  let outside = 0;

  for (const row of rows.slice(0, 2000)) {
    const benefit = cardBenefits.get(String(row.benefitId ?? ""));
    const date = parseSheetDate(String(row.date ?? ""));
    const cents = Number(row.amountCents);
    if (!benefit || !date || !Number.isInteger(cents) || cents <= 0) continue;
    if (!isCadence(benefit.cadence) || benefit.cadence === "perk") continue;
    const period = currentPeriod(benefit.cadence, date, card.openedOn);
    const valid = [
      ...periodsThisYear(benefit.cadence, now, card.openedOn),
      currentPeriod(benefit.cadence, now, card.openedOn),
    ].some((p) => p?.key === period?.key);
    if (!period || !valid || date > now) {
      outside++;
      continue;
    }
    const key = `${benefit.id}|${period.key}`;
    const entry = totals.get(key) ?? {
      benefitId: benefit.id,
      periodKey: period.key,
      cents: 0,
      cap: benefit.amountCents,
    };
    entry.cents += cents;
    totals.set(key, entry);
  }

  let changed = 0;
  for (const [key, t] of totals) {
    const usedCents = Math.max(existing.get(key) ?? 0, Math.min(t.cents, t.cap));
    if (usedCents === existing.get(key)) continue;
    await setUsage(t.benefitId, user.id, t.periodKey, usedCents);
    changed++;
  }
  refresh();
  if (totals.size === 0) {
    return {
      error: outside
        ? `None of the matched credits fall in the tracker's current periods (${outside} from earlier years skipped).`
        : "Match at least one credit to a benefit before saving.",
    };
  }
  const skipped = outside ? ` Skipped ${outside} from before this year.` : "";
  return {
    message:
      changed === 0
        ? `Everything in this file was already recorded.${skipped}`
        : `Updated ${changed} credit period${changed === 1 ? "" : "s"} on ${card.name}.${skipped}`,
  };
}

/** Record a partial amount, e.g. $6 of a $10 credit. */
export async function logAmountAction(benefitId: string, periodKey: string, form: FormData) {
  const owned = await ownedPeriod(benefitId, periodKey);
  const cents = parseDollars(text(form, "amount"));
  if (!owned || cents === null) return;
  await setUsage(benefitId, owned.user.id, periodKey, Math.min(cents, owned.benefit.amountCents));
  refresh();
}

/* ---- Cards ------------------------------------------------------------- */

export async function addCardAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const template = getTemplate(text(form, "template"));
  const name = text(form, "name") || template?.name || "";
  if (!name) return { error: "Pick a card from the list or give it a name." };
  const feeInput = text(form, "annualFee");
  const fee = feeInput ? parseDollars(feeInput) : (template?.annualFee ?? 0) * 100;
  if (fee === null) return { error: "Annual fee should be a dollar amount, like 95." };
  const openedInput = text(form, "openedOn");
  const openedOn = openedInput ? parseSheetDate(openedInput) : null;
  if (openedInput && !openedOn) return { error: "Opened date is not a valid date." };

  const id = crypto.randomUUID();
  await db.insert(perksCard).values({
    id,
    userId: user.id,
    name,
    issuer: template?.issuer ?? text(form, "issuer"),
    templateKey: template?.key ?? null,
    business: template?.business ?? form.get("business") === "on",
    annualFeeCents: fee,
    openedOn,
  });
  if (template) await addTemplateBenefits(id, user.id, template.key);
  refresh();
  redirect(`/dashboard/cards/${id}`);
}

export async function importSheetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const { cards, error } = parseCardSheet(text(form, "sheet"));
  if (error) return { error };

  const { cards: existing } = await loadPortfolio(user.id);
  const byKey = new Map(existing.map((c) => [`${c.name.toLowerCase()}|${c.openedOn ?? ""}`, c]));
  const have = new Set(byKey.keys());
  let added = 0;
  let updated = 0;
  for (const card of cards) {
    const key = `${card.name.toLowerCase()}|${card.openedOn ?? ""}`;
    const prior = byKey.get(key);
    // A card already here still picks up sign-up bonus details it was missing.
    if (prior && prior.msrCents === null && card.msrCents) {
      await db
        .update(perksCard)
        .set({
          msrCents: card.msrCents,
          msrDeadline: card.msrDeadline ?? null,
          msrSpentCents: card.msrSpentCents ?? 0,
          bonusText: card.bonusText ?? "",
          bonusReceivedOn: card.bonusReceivedOn ?? null,
        })
        .where(eq(perksCard.id, prior.id));
      updated++;
    }
    if (have.has(key)) continue;
    have.add(key);
    const id = crypto.randomUUID();
    await db.insert(perksCard).values({ id, userId: user.id, ...card });
    // Closed cards are kept for bonus eligibility only; they have nothing to track.
    if (card.templateKey && !card.closed) await addTemplateBenefits(id, user.id, card.templateKey);
    added++;
  }
  refresh();
  if (added === 0) {
    return {
      message: updated
        ? `No new cards, but added sign-up bonus details to ${updated} card${updated === 1 ? "" : "s"}.`
        : "Every card in that sheet is already here.",
    };
  }
  redirect("/dashboard/cards");
}

export async function updateCardAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const id = text(form, "id");
  const name = text(form, "name");
  const fee = parseDollars(text(form, "annualFee") || "0");
  const openedInput = text(form, "openedOn");
  const openedOn = openedInput ? parseSheetDate(openedInput) : null;
  if (!name) return { error: "Name cannot be empty." };
  if (fee === null) return { error: "Annual fee should be a dollar amount, like 95." };
  if (openedInput && !openedOn) return { error: "Opened date is not a valid date." };
  const closed = form.get("closed") === "on";
  const current = await getCard(id, user.id);
  if (!current) return { error: "Card not found." };
  await db
    .update(perksCard)
    .set({
      name,
      issuer: text(form, "issuer"),
      annualFeeCents: fee,
      openedOn,
      business: form.get("business") === "on",
      closed,
      closedOn: closed ? (current.closedOn ?? today()) : null,
    })
    .where(and(eq(perksCard.id, id), eq(perksCard.userId, user.id)));
  refresh();
  return { message: "Saved." };
}

export async function deleteCardAction(form: FormData) {
  const { user } = await requireSession();
  await db
    .delete(perksCard)
    .where(and(eq(perksCard.id, text(form, "id")), eq(perksCard.userId, user.id)));
  refresh();
  redirect("/dashboard/cards");
}

export async function applyTemplateAction(form: FormData) {
  const { user } = await requireSession();
  const card = await getCard(text(form, "id"), user.id);
  const template = getTemplate(text(form, "template"));
  if (!card || !template) return;
  await db.update(perksCard).set({ templateKey: template.key }).where(eq(perksCard.id, card.id));
  await addTemplateBenefits(card.id, user.id, template.key);
  refresh();
}

/** Brings a card's credits in line with the current catalog: adds new ones, updates changed ones. */
export async function applyCatalogUpdatesAction(cardId: string) {
  const { user } = await requireSession();
  const card = await getCard(cardId, user.id);
  if (!card?.templateKey) return;
  const benefits = await db
    .select()
    .from(perksBenefit)
    .where(and(eq(perksBenefit.cardId, card.id), eq(perksBenefit.userId, user.id)));
  const { added, changed, removed } = catalogUpdates(card.templateKey, benefits);
  if (removed.length)
    await db.delete(perksBenefit).where(
      and(
        eq(perksBenefit.userId, user.id),
        inArray(
          perksBenefit.id,
          removed.map((b) => b.id),
        ),
      ),
    );
  const nextOrder = benefits.reduce((n, b) => Math.max(n, b.sortOrder + 1), 0);
  if (added.length)
    await db.insert(perksBenefit).values(
      added.map((t, i) => ({
        id: crypto.randomUUID(),
        cardId: card.id,
        userId: user.id,
        sortOrder: nextOrder + i,
        ...templateRow(t),
      })),
    );
  for (const { benefit, template } of changed) {
    const row = templateRow(template);
    await db
      .update(perksBenefit)
      .set({
        cadence: row.cadence,
        amountCents: row.amountCents,
        endsOn: row.endsOn,
        notes: row.notes,
      })
      .where(and(eq(perksBenefit.id, benefit.id), eq(perksBenefit.userId, user.id)));
  }
  refresh();
}

/* ---- Benefits ---------------------------------------------------------- */

function benefitFields(form: FormData) {
  const name = text(form, "name");
  const cadence = text(form, "cadence");
  const amount = parseDollars(text(form, "amount") || "0");
  const endsInput = text(form, "endsOn");
  const endsOn = endsInput ? parseSheetDate(endsInput) : null;
  if (!name) return { error: "Give the benefit a name." };
  if (!isCadence(cadence)) return { error: "Choose how often the benefit resets." };
  if (amount === null) return { error: "Amount should be a dollar figure, like 10 or 12.95." };
  if (endsInput && !endsOn) return { error: "End date is not a valid date." };
  return {
    values: {
      name,
      cadence,
      amountCents: cadence === "perk" ? 0 : amount,
      notes: text(form, "notes"),
      enrollRequired: form.get("enrollRequired") === "on",
      endsOn,
    },
  };
}

export async function addBenefitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const card = await getCard(text(form, "cardId"), user.id);
  if (!card) return { error: "Card not found." };
  const parsed = benefitFields(form);
  if (!parsed.values) return { error: parsed.error };
  await db.insert(perksBenefit).values({
    id: crypto.randomUUID(),
    cardId: card.id,
    userId: user.id,
    sortOrder: 1000,
    ...parsed.values,
  });
  refresh();
  return { message: "Added." };
}

export async function updateBenefitAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = benefitFields(form);
  if (!parsed.values) return { error: parsed.error };
  await db
    .update(perksBenefit)
    .set(parsed.values)
    .where(and(eq(perksBenefit.id, text(form, "id")), eq(perksBenefit.userId, user.id)));
  refresh();
  return { message: "Saved." };
}

export async function setBenefitFlagAction(
  id: string,
  flag: "tracked" | "enrolled",
  value: boolean,
) {
  const { user } = await requireSession();
  await db
    .update(perksBenefit)
    .set({ [flag]: value })
    .where(and(eq(perksBenefit.id, id), eq(perksBenefit.userId, user.id)));
  refresh();
}

export async function deleteBenefitAction(id: string) {
  const { user } = await requireSession();
  await db
    .delete(perksBenefit)
    .where(and(eq(perksBenefit.id, id), eq(perksBenefit.userId, user.id)));
  refresh();
}

/* ---- Offers ------------------------------------------------------------ */

export async function saveOffersAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const cardId = text(form, "cardId");
  const card = cardId ? await getCard(cardId, user.id) : null;
  if (cardId && !card) return { error: "Card not found." };

  let parsed: ParsedOffer[];
  try {
    parsed = JSON.parse(text(form, "offers"));
  } catch {
    return { error: "Could not read the offers. Paste the page again." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      error: "No offers found in that text. Copy the whole offers page and paste it again.",
    };
  }

  const [existing, hidden] = await Promise.all([listOffers(user.id), listHiddenMerchants(user.id)]);
  const hiddenKeys = new Set(hidden.map((h) => h.merchantKey));
  let hiddenCount = 0;
  const have = new Set(existing.filter((o) => o.cardId === (card?.id ?? null)).map(offerKey));
  const rows = [];
  for (const o of parsed.slice(0, 300)) {
    const merchant = String(o.merchant ?? "").slice(0, 120);
    const details = String(o.details ?? "").slice(0, 300);
    const expiresOn = o.expiresOn ? parseSheetDate(String(o.expiresOn)) : null;
    if (!merchant) continue;
    const key = offerKey({ merchant, details, expiresOn });
    if (have.has(key)) continue;
    have.add(key);
    // Merchants the owner hid are kept out of their own pages but still saved,
    // so the People tab shows everything that is on the card.
    const isHidden = hiddenKeys.has(merchantKey(merchant));
    if (isHidden) hiddenCount++;
    rows.push({
      id: crypto.randomUUID(),
      userId: user.id,
      cardId: card?.id ?? null,
      merchant,
      details,
      valueCents: Number.isInteger(o.valueCents) ? o.valueCents : null,
      expiresOn,
      status: isHidden ? "hidden" : o.added ? "added" : "available",
    });
  }
  if (rows.length) await db.insert(perksOffer).values(rows);
  // Record the paste even when every offer was already saved: the page was still checked.
  if (card)
    await db
      .update(perksCard)
      .set({ offersCheckedAt: new Date() })
      .where(eq(perksCard.id, card.id));
  refresh();
  const skipped = parsed.length - rows.length;
  const shown = rows.length - hiddenCount;
  const notes = [
    skipped ? `skipped ${skipped} already saved` : "",
    hiddenCount ? `left out ${hiddenCount} from merchants you hid` : "",
  ].filter(Boolean);
  return {
    message: `Saved ${shown} offer${shown === 1 ? "" : "s"}${notes.length ? `, ${notes.join(", ")}` : ""}.`,
  };
}

export async function setOfferStatusAction(
  id: string,
  status: "available" | "added" | "used" | "dismissed",
) {
  const { user } = await requireSession();
  await db
    .update(perksOffer)
    .set({ status })
    .where(and(eq(perksOffer.id, id), eq(perksOffer.userId, user.id)));
  refresh();
}

/** Set the status of several offers at once: one offer listed on several cards. */
export async function setOffersStatusAction(ids: string[], status: "used" | "dismissed") {
  const { user } = await requireSession();
  if (ids.length === 0) return;
  await db
    .update(perksOffer)
    .set({ status })
    .where(and(inArray(perksOffer.id, ids.slice(0, 50)), eq(perksOffer.userId, user.id)));
  refresh();
}

/** Put offers back the way they were before a swipe: the Undo bar on phones. */
export async function restoreOffersAction(items: { id: string; status: string }[]) {
  const { user } = await requireSession();
  const allowed = new Set(["available", "added", "used", "dismissed"]);
  for (const { id, status } of items.slice(0, 50)) {
    if (!allowed.has(status)) continue;
    await db
      .update(perksOffer)
      .set({ status })
      .where(and(eq(perksOffer.id, id), eq(perksOffer.userId, user.id)));
  }
  refresh();
}

/** Never show offers from this merchant again, on any card. */
export async function hideMerchantAction(merchant: string) {
  const { user } = await requireSession();
  const key = merchantKey(merchant);
  if (!key) return;
  await db
    .insert(perksHiddenMerchant)
    .values({ userId: user.id, merchantKey: key, label: merchant.slice(0, 120) })
    .onConflictDoNothing();
  refresh();
}

export async function unhideMerchantAction(key: string) {
  const { user } = await requireSession();
  await db
    .delete(perksHiddenMerchant)
    .where(and(eq(perksHiddenMerchant.userId, user.id), eq(perksHiddenMerchant.merchantKey, key)));
  // Offers pasted while the merchant was hidden come back as available.
  const ids = (await listOffers(user.id))
    .filter((o) => o.status === "hidden" && merchantKey(o.merchant) === key)
    .map((o) => o.id);
  if (ids.length)
    await db
      .update(perksOffer)
      .set({ status: "available" })
      .where(and(inArray(perksOffer.id, ids), eq(perksOffer.userId, user.id)));
  refresh();
}

export async function deleteOfferAction(id: string) {
  const { user } = await requireSession();
  await db.delete(perksOffer).where(and(eq(perksOffer.id, id), eq(perksOffer.userId, user.id)));
  refresh();
}

/* ---- Settings ---------------------------------------------------------- */

export async function setDigestAction(enabled: boolean) {
  const { user } = await requireSession();
  await db
    .insert(perksSettings)
    .values({ userId: user.id, digestEnabled: enabled })
    .onConflictDoUpdate({ target: perksSettings.userId, set: { digestEnabled: enabled } });
  refresh();
}

export async function setShareRankingsAction(share: boolean) {
  const { user } = await requireSession();
  await db
    .insert(perksSettings)
    .values({ userId: user.id, shareRankings: share })
    .onConflictDoUpdate({ target: perksSettings.userId, set: { shareRankings: share } });
  refresh();
}

export async function sendDigestNowAction(): Promise<FormState> {
  const { user } = await requireSession();
  const sent = await sendDigest({ id: user.id, email: user.email, name: user.name }, today());
  if (!sent) return { message: "Nothing is expiring soon, so there is nothing to send." };
  return {
    message: process.env.RESEND_API_KEY
      ? `Sent to ${user.email}.`
      : "No email provider is configured, so the digest was printed to the server log.",
  };
}

/* ---- Sign-up bonus ----------------------------------------------------- */

export async function updateBonusAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const card = await getCard(text(form, "id"), user.id);
  if (!card) return { error: "Card not found." };
  const msrInput = text(form, "msr");
  const msr = msrInput ? parseDollars(msrInput) : null;
  const spent = parseDollars(text(form, "spent") || "0");
  const deadlineInput = text(form, "deadline");
  const deadline = deadlineInput ? parseSheetDate(deadlineInput) : null;
  const receivedInput = text(form, "received");
  const received = receivedInput ? parseSheetDate(receivedInput) : null;
  if (msrInput && msr === null)
    return { error: "Spend required should be a dollar amount, like 4000." };
  if (spent === null) return { error: "Spent so far should be a dollar amount." };
  if (deadlineInput && !deadline) return { error: "Deadline is not a valid date." };
  if (receivedInput && !received) return { error: "Bonus received is not a valid date." };
  await db
    .update(perksCard)
    .set({
      msrCents: msr && msr > 0 ? msr : null,
      msrDeadline: deadline,
      msrSpentCents: spent,
      bonusText: text(form, "bonus").slice(0, 80),
      bonusReceivedOn: received,
    })
    .where(eq(perksCard.id, card.id));
  refresh();
  return { message: "Saved." };
}

/** Quick update from the Overview: the running total spent toward the bonus. */
export async function setMsrSpentAction(cardId: string, form: FormData) {
  const { user } = await requireSession();
  const spent = parseDollars(text(form, "spent"));
  if (spent === null) return;
  await db
    .update(perksCard)
    .set({ msrSpentCents: spent })
    .where(and(eq(perksCard.id, cardId), eq(perksCard.userId, user.id)));
  refresh();
}

export async function markBonusReceivedAction(cardId: string) {
  const { user } = await requireSession();
  await db
    .update(perksCard)
    .set({ bonusReceivedOn: today() })
    .where(and(eq(perksCard.id, cardId), eq(perksCard.userId, user.id)));
  refresh();
}

/* ---- Worth to me ------------------------------------------------------- */

/** Saves "worth to me per year" for each benefit on a card. Blank means face value. */
export async function saveWorthAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const card = await getCard(text(form, "cardId"), user.id);
  if (!card) return { error: "Card not found." };
  const { benefits } = await loadPortfolio(user.id);
  for (const b of benefits.filter((x) => x.cardId === card.id)) {
    if (!form.has(`worth_${b.id}`)) continue;
    const raw = text(form, `worth_${b.id}`);
    const cents = raw ? parseDollars(raw) : null;
    if (raw && cents === null) return { error: `"${raw}" for ${b.name} is not a dollar amount.` };
    if (cents !== b.myValueCents) {
      await db.update(perksBenefit).set({ myValueCents: cents }).where(eq(perksBenefit.id, b.id));
    }
  }
  refresh();
  return { message: "Saved." };
}

/* ---- Points ------------------------------------------------------------ */

/** Cents per point as typed ("1.7") to hundredths (170). */
function parseCpp(value: string): number | null {
  const n = Number(value.replace(/[¢\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) : null;
}

export async function savePointsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const program = normalizeProgram(text(form, "program")).slice(0, 80);
  const balance = Math.round(Number(text(form, "balance").replace(/[,\s]/g, "")));
  const cppInput = text(form, "cpp");
  const cpp = cppInput ? parseCpp(cppInput) : Math.round(defaultCentsPerPoint(program) * 100);
  if (!program) return { error: "Choose a program." };
  if (!Number.isFinite(balance) || balance < 0)
    return { error: "Balance should be a number of points." };
  if (cpp === null) return { error: "Value should be cents per point, like 1.7." };
  await db
    .insert(perksPoints)
    .values({ id: crypto.randomUUID(), userId: user.id, program, balance, centsPerPointX100: cpp })
    .onConflictDoUpdate({
      target: [perksPoints.userId, perksPoints.program],
      set: { balance, centsPerPointX100: cpp, updatedAt: new Date() },
    });
  refresh();
  return { message: `Saved ${program}.` };
}

/** Paste the balances block from a sheet: each program's balance is set, values kept. */
export async function importBalancesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const rows = parseBalances(text(form, "balances"));
  if (rows.length === 0)
    return { error: 'Paste lines like "Amex MR, 270520", one program per line.' };
  const existing = new Map((await listPoints(user.id)).map((p) => [p.program, p]));
  for (const { program, balance } of rows) {
    const cpp =
      existing.get(program)?.centsPerPointX100 ?? Math.round(defaultCentsPerPoint(program) * 100);
    await db
      .insert(perksPoints)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        program,
        balance,
        centsPerPointX100: cpp,
      })
      .onConflictDoUpdate({
        target: [perksPoints.userId, perksPoints.program],
        set: { balance, updatedAt: new Date() },
      });
  }
  refresh();
  return { message: `Updated ${rows.length} balance${rows.length === 1 ? "" : "s"}.` };
}

export async function deletePointsAction(id: string) {
  const { user } = await requireSession();
  await db.delete(perksPoints).where(and(eq(perksPoints.id, id), eq(perksPoints.userId, user.id)));
  refresh();
}

export async function addRedemptionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const program = normalizeProgram(text(form, "program")).slice(0, 80);
  const points = Math.round(Number(text(form, "points").replace(/[,\s]/g, "")));
  const cash = parseDollars(text(form, "cash"));
  const fees = parseDollars(text(form, "fees") || "0");
  const dateInput = text(form, "date");
  const date = dateInput ? parseSheetDate(dateInput) : today();
  if (!program) return { error: "Choose a program." };
  if (!Number.isFinite(points) || points <= 0)
    return { error: "Points should be a positive number." };
  if (cash === null || cash <= 0) return { error: "Cash price should be a dollar amount." };
  if (fees === null) return { error: "Taxes and fees should be a dollar amount." };
  if (!date) return { error: "Date is not valid." };
  await db.insert(perksRedemption).values({
    id: crypto.randomUUID(),
    userId: user.id,
    program,
    redeemedOn: date,
    points,
    feesCents: fees,
    cashCents: cash,
    note: text(form, "note").slice(0, 120),
  });
  refresh();
  return { message: "Logged." };
}

export async function deleteRedemptionAction(id: string) {
  const { user } = await requireSession();
  await db
    .delete(perksRedemption)
    .where(and(eq(perksRedemption.id, id), eq(perksRedemption.userId, user.id)));
  refresh();
}

/* ---- Push notifications ------------------------------------------------- */

export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const { user } = await requireSession();
  if (!/^https:\/\//.test(sub.endpoint) || !sub.p256dh || !sub.auth) return;
  await db
    .insert(perksPushSubscription)
    .values({ id: crypto.randomUUID(), userId: user.id, ...sub })
    .onConflictDoUpdate({
      target: perksPushSubscription.endpoint,
      set: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth },
    });
}

export async function removePushSubscriptionAction(endpoint: string) {
  const { user } = await requireSession();
  await db
    .delete(perksPushSubscription)
    .where(
      and(eq(perksPushSubscription.endpoint, endpoint), eq(perksPushSubscription.userId, user.id)),
    );
}

export async function sendTestPushAction(): Promise<number> {
  const { user } = await requireSession();
  return sendPush(user.id, {
    title: "Perks notifications are on",
    body: "You'll get credit and offer reminders here.",
    url: "/dashboard",
    tag: "test",
  });
}

/* ---- Referrals ---------------------------------------------------------- */

export async function addReferralAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const choice = text(form, "card");
  const template = getTemplate(choice);
  const cardName = (template?.name ?? text(form, "cardName")).slice(0, 120);
  const url = text(form, "url");
  if (!cardName) return { error: "Choose the card the link is for." };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error();
  } catch {
    return { error: "Paste the full referral link, starting with https://" };
  }
  await db.insert(perksReferral).values({
    id: crypto.randomUUID(),
    userId: user.id,
    templateKey: template?.key ?? null,
    cardName,
    url: url.slice(0, 500),
    reward: text(form, "reward").slice(0, 80),
  });
  // Let the group know a new link is up, so it gets used.
  const first = user.name.split(" ")[0] || "Someone";
  const others = await otherUserIds(user.id);
  await Promise.allSettled(
    others.map((id) =>
      sendPush(id, {
        title: `${first} shared a ${cardName} referral link`,
        body: "Applying for this card? Use their link so the bonus stays in the group.",
        url: "/dashboard/bonuses#referrals",
        tag: "referral",
      }),
    ),
  );
  refresh();
  return {
    message: `Shared your ${cardName} link.${others.length ? " Everyone with notifications on was told." : ""}`,
  };
}

export async function deleteReferralAction(id: string) {
  const { user } = await requireSession();
  await db
    .delete(perksReferral)
    .where(and(eq(perksReferral.id, id), eq(perksReferral.userId, user.id)));
  refresh();
}

/* ---- Spend goals -------------------------------------------------------- */

/** Records the total spent on the card so far this calendar year. */
export async function setSpendTargetAction(id: string, form: FormData) {
  const { user } = await requireSession();
  const spent = parseDollars(text(form, "spent"));
  if (spent === null) return;
  await db
    .update(perksSpendTarget)
    .set({ spentCents: spent, periodKey: today().slice(0, 4) })
    .where(and(eq(perksSpendTarget.id, id), eq(perksSpendTarget.userId, user.id)));
  refresh();
}

export async function setSpendTargetTrackedAction(id: string, tracked: boolean) {
  const { user } = await requireSession();
  await db
    .update(perksSpendTarget)
    .set({ tracked })
    .where(and(eq(perksSpendTarget.id, id), eq(perksSpendTarget.userId, user.id)));
  refresh();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  and,
  db,
  eq,
  perksBenefit,
  perksCard,
  perksOffer,
  perksSettings,
  perksUsage,
} from "@kch/db";
import { getTemplate } from "@/lib/catalog";
import { sendDigest } from "@/lib/digest";
import { parseDollars } from "@/lib/money";
import { offerKey, type ParsedOffer } from "@/lib/offer-parse";
import {
  addTemplateBenefits,
  getBenefit,
  getCard,
  listOffers,
  loadPortfolio,
  today,
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
  const have = new Set(existing.map((c) => `${c.name.toLowerCase()}|${c.openedOn ?? ""}`));
  let added = 0;
  for (const card of cards) {
    const key = `${card.name.toLowerCase()}|${card.openedOn ?? ""}`;
    if (have.has(key)) continue;
    have.add(key);
    const id = crypto.randomUUID();
    await db.insert(perksCard).values({ id, userId: user.id, ...card });
    // Closed cards are kept for bonus eligibility only; they have nothing to track.
    if (card.templateKey && !card.closed) await addTemplateBenefits(id, user.id, card.templateKey);
    added++;
  }
  refresh();
  if (added === 0) return { message: "Every card in that sheet is already here." };
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

  const existing = await listOffers(user.id);
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
    rows.push({
      id: crypto.randomUUID(),
      userId: user.id,
      cardId: card?.id ?? null,
      merchant,
      details,
      valueCents: Number.isInteger(o.valueCents) ? o.valueCents : null,
      expiresOn,
      status: o.added ? "added" : "available",
    });
  }
  if (rows.length) await db.insert(perksOffer).values(rows);
  refresh();
  const skipped = parsed.length - rows.length;
  return {
    message: `Saved ${rows.length} offer${rows.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already saved` : ""}.`,
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

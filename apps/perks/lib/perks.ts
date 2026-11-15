import "server-only";
import {
  and,
  inArray,
  asc,
  db,
  eq,
  perksBenefit,
  perksCard,
  perksHiddenMerchant,
  perksPoints,
  perksReferral,
  perksSpendTarget,
  user,
  perksRedemption,
  perksOffer,
  perksSettings,
  perksUsage,
  type PerksBenefit,
  type PerksCard,
  type PerksOffer,
  type PerksUsage,
} from "@kch/db";
import { getTemplate } from "./catalog";
import { SPEND_TARGETS } from "./spend-targets";
import { todayIn } from "./periods";
import { summarizeCards } from "./summary";

/** Today's date where the owner lives; credits reset on the bank's calendar, not UTC. */
export function today(): string {
  return todayIn(process.env.PERKS_TIMEZONE || "America/New_York");
}

/** The owner's calendar date for a stored timestamp. */
export function dateOf(at: Date): string {
  return todayIn(process.env.PERKS_TIMEZONE || "America/New_York", at);
}

export type Portfolio = {
  cards: PerksCard[];
  benefits: PerksBenefit[];
  usage: PerksUsage[];
};

export async function loadPortfolio(userId: string): Promise<Portfolio> {
  const [cards, benefits, usage] = await Promise.all([
    db.select().from(perksCard).where(eq(perksCard.userId, userId)).orderBy(asc(perksCard.name)),
    db
      .select()
      .from(perksBenefit)
      .where(eq(perksBenefit.userId, userId))
      .orderBy(asc(perksBenefit.sortOrder), asc(perksBenefit.name)),
    db.select().from(perksUsage).where(eq(perksUsage.userId, userId)),
  ]);
  return { cards, benefits, usage };
}

export async function getCard(id: string, userId: string): Promise<PerksCard | null> {
  const [row] = await db
    .select()
    .from(perksCard)
    .where(and(eq(perksCard.id, id), eq(perksCard.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getBenefit(id: string, userId: string): Promise<PerksBenefit | null> {
  const [row] = await db
    .select()
    .from(perksBenefit)
    .where(and(eq(perksBenefit.id, id), eq(perksBenefit.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listOffers(userId: string): Promise<PerksOffer[]> {
  return db
    .select()
    .from(perksOffer)
    .where(eq(perksOffer.userId, userId))
    .orderBy(asc(perksOffer.expiresOn), asc(perksOffer.merchant));
}

/**
 * Everyone's pasted offers with the cards they are on, for the People tab.
 * Perks is limited to a small group (ALLOWED_EMAILS), so like referral links
 * these are visible to everyone signed in. Only fields shown on the page are
 * returned: no emails, card dates or spending.
 */
export async function listEveryonesOffers() {
  const [people, offers, cards] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user),
    db
      .select({
        id: perksOffer.id,
        userId: perksOffer.userId,
        cardId: perksOffer.cardId,
        merchant: perksOffer.merchant,
        details: perksOffer.details,
        valueCents: perksOffer.valueCents,
        expiresOn: perksOffer.expiresOn,
        status: perksOffer.status,
      })
      .from(perksOffer)
      .orderBy(asc(perksOffer.expiresOn), asc(perksOffer.merchant)),
    db
      .select({
        id: perksCard.id,
        name: perksCard.name,
        issuer: perksCard.issuer,
        templateKey: perksCard.templateKey,
        userId: perksCard.userId,
        offersCheckedAt: perksCard.offersCheckedAt,
      })
      .from(perksCard),
  ]);
  return { people, offers, cards };
}

export async function listPoints(userId: string) {
  return db
    .select()
    .from(perksPoints)
    .where(eq(perksPoints.userId, userId))
    .orderBy(asc(perksPoints.program));
}

export async function listRedemptions(userId: string) {
  return db
    .select()
    .from(perksRedemption)
    .where(eq(perksRedemption.userId, userId))
    .orderBy(asc(perksRedemption.redeemedOn));
}

/**
 * Every referral link in the app, with the first name of whoever shared it.
 * Perks is limited to a small group (ALLOWED_EMAILS), so links are shared
 * with everyone signed in.
 */
export async function listReferrals() {
  const rows = await db
    .select({
      id: perksReferral.id,
      userId: perksReferral.userId,
      templateKey: perksReferral.templateKey,
      cardName: perksReferral.cardName,
      url: perksReferral.url,
      reward: perksReferral.reward,
      name: user.name,
    })
    .from(perksReferral)
    .innerJoin(user, eq(user.id, perksReferral.userId))
    .orderBy(asc(perksReferral.cardName));
  return rows.map((r) => ({ ...r, firstName: r.name.split(" ")[0] || r.name }));
}

/** Adds the catalog's spend goals to open cards that don't have them yet. */
export async function ensureSpendTargets(userId: string, cards: PerksCard[]) {
  const rows = cards.flatMap((c) =>
    c.closed || !c.templateKey
      ? []
      : (SPEND_TARGETS[c.templateKey] ?? []).map((t) => ({
          id: crypto.randomUUID(),
          cardId: c.id,
          userId,
          name: t.name,
          reward: t.reward,
          targetCents: t.targetDollars * 100,
        })),
  );
  if (rows.length) await db.insert(perksSpendTarget).values(rows).onConflictDoNothing();
}

export async function listSpendTargets(userId: string) {
  return db
    .select()
    .from(perksSpendTarget)
    .where(eq(perksSpendTarget.userId, userId))
    .orderBy(asc(perksSpendTarget.name));
}

export async function listHiddenMerchants(userId: string) {
  return db
    .select()
    .from(perksHiddenMerchant)
    .where(eq(perksHiddenMerchant.userId, userId))
    .orderBy(asc(perksHiddenMerchant.label));
}

export async function getSettings(userId: string) {
  const [row] = await db
    .select()
    .from(perksSettings)
    .where(eq(perksSettings.userId, userId))
    .limit(1);
  return row ?? { userId, digestEnabled: true, lastDigestOn: null, shareRankings: true };
}

/**
 * Everyone in the group holding the same kind of card, ranked by credits used
 * this year. Only totals are returned, and people who switched sharing off in
 * Settings are left out (except the viewer, who always sees their own row).
 */
export async function cardStandings(templateKey: string, viewerId: string, today: string) {
  const cards = await db
    .select()
    .from(perksCard)
    .where(and(eq(perksCard.templateKey, templateKey), eq(perksCard.closed, false)));
  if (cards.length < 2) return [];
  const userIds = [...new Set(cards.map((c) => c.userId))];
  const [people, prefs, benefits, usage] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds)),
    db.select().from(perksSettings).where(inArray(perksSettings.userId, userIds)),
    db
      .select()
      .from(perksBenefit)
      .where(
        inArray(
          perksBenefit.cardId,
          cards.map((c) => c.id),
        ),
      ),
    db.select().from(perksUsage).where(inArray(perksUsage.userId, userIds)),
  ]);
  const hidden = new Set(prefs.filter((p) => !p.shareRankings).map((p) => p.userId));
  const nameOf = new Map(people.map((p) => [p.id, p.name.split(" ")[0] || p.name]));
  return summarizeCards(cards, benefits, usage, today)
    .filter((s) => s.card.userId === viewerId || !hidden.has(s.card.userId))
    .map((s) => ({
      cardId: s.card.id,
      userId: s.card.userId,
      firstName: nameOf.get(s.card.userId) ?? "Someone",
      capturedCents: s.capturedCents,
      availableCents: s.availableCents,
      share: s.availableCents ? s.capturedCents / s.availableCents : 0,
    }))
    .sort((a, b) => b.capturedCents - a.capturedCents || b.share - a.share);
}

/** Copy a catalog template's benefits onto a card. */
export async function addTemplateBenefits(cardId: string, userId: string, templateKey: string) {
  const template = getTemplate(templateKey);
  if (!template || template.benefits.length === 0) return;
  await db.insert(perksBenefit).values(
    template.benefits.map((b, i) => ({
      id: crypto.randomUUID(),
      cardId,
      userId,
      name: b.name,
      cadence: b.cadence,
      amountCents: Math.round((b.amount ?? 0) * 100),
      notes: b.notes ?? "",
      enrollRequired: b.enroll ?? false,
      endsOn: b.endsOn ?? null,
      sortOrder: i,
    })),
  );
}

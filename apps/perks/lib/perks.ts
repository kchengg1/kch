import "server-only";
import {
  and,
  asc,
  db,
  eq,
  perksBenefit,
  perksCard,
  perksOffer,
  perksSettings,
  perksUsage,
  type PerksBenefit,
  type PerksCard,
  type PerksOffer,
  type PerksUsage,
} from "@kch/db";
import { getTemplate } from "./catalog";
import { todayIn } from "./periods";

/** Today's date where the owner lives; credits reset on the bank's calendar, not UTC. */
export function today(): string {
  return todayIn(process.env.PERKS_TIMEZONE || "America/New_York");
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

export async function getSettings(userId: string) {
  const [row] = await db
    .select()
    .from(perksSettings)
    .where(eq(perksSettings.userId, userId))
    .limit(1);
  return row ?? { userId, digestEnabled: true, lastDigestOn: null };
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

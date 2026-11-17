import "server-only";
import { recordActivity } from "@kch/auth/server";
import { auth } from "./auth";
import { buildMobileBootstrap, type MobileBootstrap } from "./mobile-api";
import {
  dateOf,
  ensureSpendTargets,
  getSettings,
  listEveryonesOffers,
  listHiddenMerchants,
  listOffers,
  listPoints,
  listRedemptions,
  listReferrals,
  listSpendTargets,
  loadGroupCards,
  loadPortfolio,
  today,
} from "./perks";

export type MobileUser = { id: string; name: string; email: string };

/** Read the authenticated user from either a Bearer token or session cookie. */
export async function getMobileUser(request: Request): Promise<MobileUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  recordActivity(session.user.id);
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
}

/** Load and shape the caller's complete Perks snapshot. */
export async function loadMobileBootstrap(user: MobileUser): Promise<MobileBootstrap> {
  const now = today();
  const [
    portfolio,
    offers,
    hiddenMerchants,
    points,
    redemptions,
    settings,
    referrals,
    groupOffers,
    groupCards,
  ] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
    listHiddenMerchants(user.id),
    listPoints(user.id),
    listRedemptions(user.id),
    getSettings(user.id),
    listReferrals(),
    listEveryonesOffers(),
    loadGroupCards(),
  ]);

  await ensureSpendTargets(user.id, portfolio.cards);
  const spendTargets = await listSpendTargets(user.id);

  return buildMobileBootstrap({
    user,
    today: now,
    cards: portfolio.cards,
    benefits: portfolio.benefits,
    usage: portfolio.usage,
    offers,
    hiddenMerchants,
    points,
    redemptions,
    settings: {
      digestEnabled: settings.digestEnabled,
      lastDigestOn: settings.lastDigestOn,
      shareRankings: settings.shareRankings,
    },
    spendTargets,
    referrals,
    groupOffers,
    groupCards,
    dateOf,
  });
}

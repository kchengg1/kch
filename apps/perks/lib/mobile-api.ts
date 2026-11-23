import type {
  BenefitStatus,
  BonusOffer,
  BonusVerdict,
  Cadence,
  CardStyle,
  MobileActionPayload,
  MobileActionResponse,
  MobileBenefit,
  MobileBootstrap,
  MobileCard,
  MobileCardCatalogUpdates,
  MobileCardStanding,
  MobileOfferGroup,
  MobilePeopleData,
  MobilePersonCard,
  MobilePersonOfferGroup,
  MobileReferral,
  MobileSpendTarget,
  MobileUsageChip,
  MobileYearEnd,
  MsrStatus,
  OfferStatus,
  RedemptionCheck,
  RuleResult,
  StatementPreviewPayload,
} from "@kch/perks-types";
import bonusData from "../data/signup-bonuses.json";
import { cardStyle } from "./card-style";
import { CATALOG, CATALOG_REVIEWED, getTemplate, onStatement } from "./catalog";
import { catalogUpdates, updateCount } from "./catalog-sync";
import { checkEligibility, fiveTwentyFour } from "./eligibility";
import { creditBreakdown, groupStandings } from "./group-standings";
import { formatCents, parseDollars } from "./money";
import { msrStatus } from "./msr";
import { offerCategory } from "./offer-category";
import { groupOffers, merchantKey } from "./offer-groups";
import { isWeakOffer, offerReturn, rateLabel, WEAK_RATE } from "./offer-value";
import {
  CADENCE_LABEL,
  daysBetween,
  isCadence,
  periodsThisYear,
  shortLabel,
  todayIn,
} from "./periods";
import {
  PROGRAMS,
  VALUATION_SOURCE,
  balanceValueCents,
  checkRedemption,
  defaultCentsPerPoint,
  defaultCentsPerPointX100,
  effectiveCentsPerPointX100,
  normalizeProgram,
  resolvePointValuation,
} from "./points";
import { shareableCards } from "./referrals";
import { applicationRules } from "./rules";
import { firstName, offersByPerson, onCardMerchantKeys } from "./shared-offers";
import { parseSheetDate } from "./sheet-import";
import { spentThisYear } from "./spend-targets";
import { actionable, buildStatuses, indexUsage, summarizeCards, usedIn } from "./summary";
import { cardWorth, faceValueCents, myValueCents } from "./worth";
import {
  anniversaryUnused,
  APPLY_LATER,
  APPLY_NOW,
  applyTips,
  endsForGood,
  expiringAtYearEnd,
  inYearEndWindow,
  notesFor,
  YEAR_END_SOURCE,
  yearEndOf,
} from "./year-end";

export type {
  MobileActionPayload,
  MobileActionResponse,
  MobileBenefit,
  MobileBootstrap,
  MobileCard,
  MobileOfferGroup,
  MobileReferral,
  MobileSpendTarget,
  MobileUsageChip,
  OfferStatus,
  StatementPreviewPayload,
};

/** Credits ending within this window sit in the main list on Overview. */
const SOON_DAYS = 45;
const OFFER_DAYS = 14;
const FEE_DAYS = 60;
const STALE_OFFER_DAYS = 14;

export type MobileCardInput = {
  id: string;
  name: string;
  issuer: string;
  templateKey: string | null;
  business: boolean;
  annualFeeCents: number;
  openedOn: string | null;
  closedOn: string | null;
  closed: boolean;
  msrCents: number | null;
  msrDeadline: string | null;
  msrSpentCents: number;
  bonusText: string;
  bonusReceivedOn: string | null;
  offersCheckedAt: Date | null;
};

export type MobileBenefitInput = {
  id: string;
  cardId: string;
  name: string;
  cadence: string;
  amountCents: number;
  notes: string;
  enrollRequired: boolean;
  enrolled: boolean;
  myValueCents: number | null;
  tracked: boolean;
  endsOn: string | null;
  sortOrder: number;
};

export type MobileUsageInput = {
  benefitId: string;
  periodKey: string;
  usedCents: number;
};

export type MobileOfferInput = {
  id: string;
  cardId: string | null;
  merchant: string;
  details: string;
  valueCents: number | null;
  expiresOn: string | null;
  status: string;
};

export type MobileHiddenMerchantInput = {
  merchantKey: string;
  label: string;
};

export type MobilePointsInput = {
  id: string;
  program: string;
  balance: number;
  centsPerPointX100: number;
  customValue?: boolean;
};

export type MobileRedemptionInput = {
  id: string;
  program: string;
  redeemedOn: string;
  points: number;
  feesCents: number;
  cashCents: number;
  note: string;
};

export type MobileSpendTargetInput = {
  id: string;
  cardId: string;
  name: string;
  reward: string;
  targetCents: number;
  spentCents: number;
  periodKey: string;
  tracked: boolean;
};

export type MobileReferralInput = {
  id: string;
  userId: string;
  firstName: string;
  templateKey: string | null;
  cardName: string;
  url: string;
  reward: string;
};

export type MobileGroupOffersInput = {
  people: { id: string; name: string; lastActiveAt?: Date | string | null }[];
  offers: (MobileOfferInput & { userId: string })[];
  cards: {
    id: string;
    name: string;
    issuer: string;
    templateKey: string | null;
    userId: string;
    offersCheckedAt: Date | null;
  }[];
};

export type MobileGroupCardsInput = {
  cards: {
    id: string;
    userId: string;
    name: string;
    issuer: string;
    templateKey: string | null;
    annualFeeCents: number;
    openedOn: string | null;
    closed: boolean;
  }[];
  benefits: MobileBenefitInput[];
  usage: MobileUsageInput[];
  hidden: Set<string>;
};

export type MobileBootstrapInput = {
  user: { id: string; name: string; email: string };
  today: string;
  cards: MobileCardInput[];
  benefits: MobileBenefitInput[];
  usage: MobileUsageInput[];
  offers: MobileOfferInput[];
  hiddenMerchants: MobileHiddenMerchantInput[];
  points: MobilePointsInput[];
  redemptions: MobileRedemptionInput[];
  settings: {
    digestEnabled: boolean;
    lastDigestOn: string | null;
    shareRankings?: boolean;
    lastActiveAt?: string | null;
  };
  spendTargets?: MobileSpendTargetInput[];
  referrals?: MobileReferralInput[];
  groupOffers?: MobileGroupOffersInput;
  groupCards?: MobileGroupCardsInput;
  dateOf?: (at: Date) => string;
};

const BONUS_ORDER: Record<BonusVerdict["status"], number> = {
  eligible: 0,
  caution: 1,
  ineligible: 2,
};

function formatCatalogMoney(cents: number, cadence: string): string {
  if (cadence === "perk") return "ongoing perk";
  const label = isCadence(cadence) ? CADENCE_LABEL[cadence].toLowerCase() : cadence;
  return `${formatCents(cents)} ${label}`;
}

/** Shape all user state into a single serialisable snapshot for the iOS app. */
export function buildMobileBootstrap(input: MobileBootstrapInput): MobileBootstrap {
  const {
    user,
    today,
    cards,
    benefits,
    usage,
    offers,
    hiddenMerchants,
    points,
    redemptions,
    settings,
    spendTargets = [],
    referrals = [],
    groupOffers: groupOffersInput,
    groupCards: groupCardsInput,
    dateOf = (at: Date) => todayIn("America/New_York", at),
  } = input;

  const shareRankings = settings.shareRankings ?? true;
  const usageIndex = indexUsage(usage);
  const summaries = summarizeCards(cards, benefits, usage, today);
  const summaryById = new Map(summaries.map((s) => [s.card.id, s]));
  const cardById = new Map(cards.map((c) => [c.id, c]));

  // Precompute group standings & per-template card standings if group data is present.
  const peopleList = groupOffersInput?.people ?? [{ id: user.id, name: user.name }];
  const personNameById = new Map(peopleList.map((p) => [p.id, firstName(p.name)]));
  const groupSummaries = groupCardsInput
    ? summarizeCards(groupCardsInput.cards, groupCardsInput.benefits, groupCardsInput.usage, today)
    : [];
  const groupHidden = groupCardsInput?.hidden ?? new Set<string>();
  const standingsByTemplate = new Map<string, MobileCardStanding[]>();

  if (groupCardsInput) {
    const visibleGroup = groupSummaries.filter(
      (s) => s.card.userId === user.id || !groupHidden.has(s.card.userId),
    );
    const byTemplate = new Map<string, typeof visibleGroup>();
    for (const s of visibleGroup) {
      if (!s.card.templateKey) continue;
      byTemplate.set(s.card.templateKey, [...(byTemplate.get(s.card.templateKey) ?? []), s]);
    }
    for (const [templateKey, holders] of byTemplate.entries()) {
      if (holders.length < 2) continue;
      const ranked: MobileCardStanding[] = holders
        .map((s) => ({
          cardId: s.card.id,
          userId: s.card.userId,
          firstName: personNameById.get(s.card.userId) ?? "Someone",
          isMe: s.card.userId === user.id,
          capturedCents: s.capturedCents,
          availableCents: s.availableCents,
          share: s.availableCents ? s.capturedCents / s.availableCents : 0,
        }))
        .sort((a, b) => b.capturedCents - a.capturedCents || b.share - a.share);
      standingsByTemplate.set(templateKey, ranked);
    }
  }

  const mobileCards: MobileCard[] = cards.map((card) => {
    const cardBenefits = benefits.filter((b) => b.cardId === card.id);
    const summary = summaryById.get(card.id);
    const mappedBenefits: MobileBenefit[] = cardBenefits.map((b) => {
      const cadence: Cadence = isCadence(b.cadence) ? b.cadence : "annual";
      const expired = Boolean(b.endsOn && b.endsOn < today);
      const periods = periodsThisYear(cadence, today, card.openedOn);
      const chips: MobileUsageChip[] = periods.map((p) => {
        const loggedVal = usedIn(usageIndex, b.id, p.key);
        const logged = loggedVal !== undefined;
        const full = logged && loggedVal >= b.amountCents;
        const partial = !full && (loggedVal ?? 0) > 0;
        return {
          key: p.key,
          label: p.label,
          shortLabel: shortLabel(cadence, p),
          start: p.start,
          end: p.end,
          logged,
          usedCents: loggedVal ?? 0,
          full,
          partial,
          future: p.start > today,
          current: p.start <= today && p.end >= today,
        };
      });
      const openPastCount = chips.filter((c) => c.end < today && !c.logged).length;
      return {
        ...b,
        cadence,
        cadenceLabel: CADENCE_LABEL[cadence],
        expired,
        inApp: !onStatement(card.templateKey, b.name),
        faceYearlyCents: faceValueCents(b),
        effectiveWorthCents: myValueCents(b),
        periods: chips,
        openPastCount,
      };
    });

    const rawUpdates =
      card.closed || cardBenefits.length === 0
        ? { added: [], changed: [], removed: [] }
        : catalogUpdates(card.templateKey, cardBenefits);
    const cardCatalogUpdates: MobileCardCatalogUpdates = {
      count: updateCount(rawUpdates),
      added: rawUpdates.added.map((t) =>
        t.cadence === "perk"
          ? `New: ${t.name}`
          : `New: ${t.name} (${formatCatalogMoney(Math.round((t.amount ?? 0) * 100), t.cadence)})`,
      ),
      changed: rawUpdates.changed.map(
        ({ benefit: b, template: t }) =>
          `Changed: ${b.name} (${formatCatalogMoney(b.amountCents, b.cadence)} → ${formatCatalogMoney(Math.round((t.amount ?? 0) * 100), t.cadence)})`,
      ),
      removed: rawUpdates.removed.map((b) => `Removed: ${b.name}`),
    };

    const standings =
      !card.closed && card.templateKey ? (standingsByTemplate.get(card.templateKey) ?? []) : [];

    return {
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      templateKey: card.templateKey,
      style: cardStyle(card.templateKey, card.issuer),
      business: card.business,
      annualFeeCents: card.annualFeeCents,
      openedOn: card.openedOn,
      closedOn: card.closedOn,
      closed: card.closed,
      msrCents: card.msrCents,
      msrDeadline: card.msrDeadline,
      msrSpentCents: card.msrSpentCents,
      bonusText: card.bonusText,
      bonusReceivedOn: card.bonusReceivedOn,
      offersCheckedOn: card.offersCheckedAt ? dateOf(card.offersCheckedAt) : null,
      availableCents: summary?.availableCents ?? 0,
      capturedCents: summary?.capturedCents ?? 0,
      nextFeeOn: summary?.nextFeeOn ?? null,
      msr: msrStatus(card, today),
      worth: cardWorth(cardBenefits, card.annualFeeCents, today),
      catalogUpdates: cardCatalogUpdates,
      standings,
      benefits: mappedBenefits,
    };
  });

  const mobileCardById = new Map(mobileCards.map((c) => [c.id, c]));
  const openCards = mobileCards.filter((c) => !c.closed);
  const openCardById = new Map(openCards.map((c) => [c.id, c]));

  // Statuses & Overview calculations
  const rawStatuses = buildStatuses(cards, benefits, usage, today);
  const toMobileStatus = (s: (typeof rawStatuses)[number]): BenefitStatus => ({
    ...s,
    cardStyle: cardStyle(s.card.templateKey, s.card.issuer),
  });
  const todo = actionable(rawStatuses).map(toMobileStatus);
  const soon = todo.filter((s) => (s.daysLeft ?? 0) <= SOON_DAYS);
  const later = todo.filter((s) => (s.daysLeft ?? 0) > SOON_DAYS);
  const thisMonth = todo.filter((s) => s.deadline && s.deadline.slice(0, 7) === today.slice(0, 7));
  const sumRemaining = (list: BenefitStatus[]) => list.reduce((n, s) => n + s.remainingCents, 0);

  const capturedCents = summaries.reduce((n, s) => n + s.capturedCents, 0);
  const availableCents = summaries.reduce((n, s) => n + s.availableCents, 0);
  const annualFeesCents = openCards.reduce((n, c) => n + c.annualFeeCents, 0);

  const activeBonuses = openCards
    .filter(
      (c): c is MobileCard & { msr: MsrStatus } =>
        c.msr !== null && (c.msr.state === "active" || c.msr.state === "met"),
    )
    .sort((a, b) => (a.msr.daysLeft ?? 9999) - (b.msr.daysLeft ?? 9999))
    .map((c) => ({
      cardId: c.id,
      cardName: c.name,
      cardStyle: c.style,
      bonusText: c.bonusText,
      msr: c.msr,
    }));

  // Spend targets on open cards
  const mappedSpendTargets: MobileSpendTarget[] = spendTargets
    .filter((g) => openCardById.has(g.cardId))
    .map((g) => {
      const c = openCardById.get(g.cardId)!;
      return {
        id: g.id,
        cardId: g.cardId,
        cardName: c.name,
        cardStyle: c.style,
        name: g.name,
        reward: g.reward,
        targetCents: g.targetCents,
        spentCents: spentThisYear(g, today),
        tracked: g.tracked,
      };
    });

  const activeSpendTargets = mappedSpendTargets
    .filter((g) => g.tracked)
    .sort((a, b) => b.spentCents / b.targetCents - a.spentCents / a.targetCents);
  const untrackedSpendTargets = mappedSpendTargets.filter((g) => !g.tracked);

  const catalogUpdateCards = openCards
    .filter((c) => c.catalogUpdates.count > 0)
    .map((c) => ({
      cardId: c.id,
      cardName: c.name,
      cardStyle: c.style,
      count: c.catalogUpdates.count,
      summary: [
        ...c.catalogUpdates.added,
        ...c.catalogUpdates.changed,
        ...c.catalogUpdates.removed,
      ],
    }));

  // Offers grouping & scoring
  const hiddenKeys = new Set(hiddenMerchants.map((h) => h.merchantKey));
  const toOfferGroup = (
    g: ReturnType<typeof groupOffers<MobileOfferInput>>[number],
  ): MobileOfferGroup => {
    const ret = offerReturn(g.details);
    const rate = ret?.rate ?? null;
    const maxCents = ret?.maxCents ?? g.valueCents;
    return {
      key: g.key,
      merchant: g.merchant,
      details: g.details,
      category: offerCategory(g.merchant, g.details),
      valueCents: g.valueCents,
      maxCents,
      rate,
      rateLabel: rate !== null ? rateLabel(rate) : null,
      weak: rate !== null && rate < WEAK_RATE,
      expiresOn: g.expiresOn,
      daysLeft: g.expiresOn ? daysBetween(today, g.expiresOn) : null,
      items: g.items.map((o) => {
        const c = o.cardId ? cardById.get(o.cardId) : undefined;
        return {
          id: o.id,
          cardId: o.cardId,
          cardName: c?.name ?? "Any card",
          cardStyle: cardStyle(c?.templateKey, c?.issuer),
          status: o.status,
        };
      }),
    };
  };

  const expiringRaw = offers.filter(
    (o) =>
      (o.status === "available" || o.status === "added") &&
      o.expiresOn !== null &&
      o.expiresOn >= today &&
      daysBetween(today, o.expiresOn) <= OFFER_DAYS &&
      !hiddenKeys.has(merchantKey(o.merchant)) &&
      !isWeakOffer(o.details),
  );
  const expiringOffers = groupOffers(expiringRaw).map(toOfferGroup);

  const feesDue = openCards
    .filter((c): c is MobileCard & { nextFeeOn: string } =>
      Boolean(c.nextFeeOn && daysBetween(today, c.nextFeeOn) <= FEE_DAYS),
    )
    .sort((a, b) => a.nextFeeOn.localeCompare(b.nextFeeOn))
    .map((c) => ({
      cardId: c.id,
      cardName: c.name,
      cardStyle: c.style,
      annualFeeCents: c.annualFeeCents,
      nextFeeOn: c.nextFeeOn,
      capturedCents: c.capturedCents,
      worthCents: c.worth.worthCents,
      netCents: c.worth.netCents,
    }));

  const isExpiredOffer = (o: MobileOfferInput) => o.expiresOn !== null && o.expiresOn < today;
  const liveOffers = offers.filter(
    (o) =>
      (o.status === "available" || o.status === "added") &&
      !isExpiredOffer(o) &&
      !hiddenKeys.has(merchantKey(o.merchant)),
  );
  const pastOffers = offers.filter(
    (o) =>
      o.status !== "hidden" &&
      (!(o.status === "available" || o.status === "added") || isExpiredOffer(o)),
  );
  const scoredGroups = groupOffers(liveOffers)
    .map(toOfferGroup)
    .sort(
      (a, b) =>
        (b.rate ?? -1) - (a.rate ?? -1) ||
        (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"),
    );
  const strong = scoredGroups.filter((g) => !g.weak);
  const weak = scoredGroups.filter((g) => g.weak);
  const strongValueCents = strong.reduce((n, g) => n + (g.maxCents ?? 0), 0);

  const offerEligibleCards = [...openCards]
    .sort(
      (a, b) =>
        Number(/american express|chase/i.test(b.issuer)) -
          Number(/american express|chase/i.test(a.issuer)) || a.name.localeCompare(b.name),
    )
    .filter((c) => /american express|chase/i.test(c.issuer) || c.offersCheckedOn !== null);

  const cardChecks = offerEligibleCards.map((c) => {
    const daysAgo = c.offersCheckedOn ? daysBetween(c.offersCheckedOn, today) : null;
    return {
      cardId: c.id,
      cardName: c.name,
      cardStyle: c.style,
      checkedOn: c.offersCheckedOn,
      daysAgo,
      stale: daysAgo === null || daysAgo > STALE_OFFER_DAYS,
    };
  });

  // Points & Redemptions
  const pointRows = points
    .map((p) => {
      const effectiveCppX100 = effectiveCentsPerPointX100(p);
      const defaultCppX100 = defaultCentsPerPointX100(p.program);
      return {
        id: p.id,
        program: p.program,
        balance: p.balance,
        centsPerPointX100: effectiveCppX100,
        defaultCentsPerPointX100: defaultCppX100,
        customValue: Boolean(p.customValue),
        valueCents: Math.round(balanceValueCents(p.balance, effectiveCppX100) / 100) * 100,
      };
    })
    .sort((a, b) => b.valueCents - a.valueCents);
  const totalValueCents = pointRows.reduce((n, r) => n + r.valueCents, 0);
  const totalPoints = pointRows.reduce((n, r) => n + r.balance, 0);
  const valueByProgram = new Map(pointRows.map((p) => [p.program, p.centsPerPointX100 / 100]));
  const programOptions = [
    ...pointRows.map((r) => ({
      program: r.program,
      centsPerPoint: r.centsPerPointX100 / 100,
      defaultCentsPerPoint: r.defaultCentsPerPointX100 / 100,
    })),
    ...PROGRAMS.filter((p) => !valueByProgram.has(p)).map((p) => ({
      program: p,
      centsPerPoint: defaultCentsPerPoint(p),
      defaultCentsPerPoint: defaultCentsPerPoint(p),
    })),
  ];
  const mappedRedemptions: (MobileRedemptionInput & {
    centsPerPoint: number;
    targetCentsPerPoint: number;
    check: RedemptionCheck | null;
  })[] = [...redemptions].reverse().map((r) => {
    const targetCentsPerPoint = valueByProgram.get(r.program) ?? defaultCentsPerPoint(r.program);
    const centsPerPoint = r.points > 0 ? (r.cashCents - r.feesCents) / r.points : 0;
    return {
      ...r,
      centsPerPoint,
      targetCentsPerPoint,
      check: checkRedemption({
        cashCents: r.cashCents,
        points: r.points,
        feesCents: r.feesCents,
        valueCentsPerPoint: targetCentsPerPoint,
      }),
    };
  });

  // Referrals
  const mappedReferrals: MobileReferral[] = referrals.map((r) => {
    const tpl = getTemplate(r.templateKey);
    return {
      id: r.id,
      userId: r.userId,
      firstName: r.firstName,
      templateKey: r.templateKey,
      cardName: r.cardName,
      cardStyle: cardStyle(r.templateKey, tpl?.issuer),
      url: r.url,
      reward: r.reward,
    };
  });
  const myReferrals = mappedReferrals.filter((r) => r.userId === user.id);
  const otherReferrals = mappedReferrals.filter((r) => r.userId !== user.id);
  const shareable = shareableCards(cards, referrals, user.id).map((c) => ({
    cardId: c.id,
    name: c.name,
    templateKey: c.templateKey!,
    style: cardStyle(c.templateKey, c.issuer),
  }));

  // Sign-up bonus eligibility & issuer rules + friend referral links
  const bonusRows = (bonusData.offers as BonusOffer[])
    .map((offer) => {
      const re = new RegExp(offer.match, "i");
      const friendReferrals = otherReferrals.filter(
        (r) => (offer.templateKey && r.templateKey === offer.templateKey) || re.test(r.cardName),
      );
      return {
        offer,
        verdict: checkEligibility(offer, cards, today),
        friendReferrals,
      };
    })
    .sort(
      (a, b) =>
        BONUS_ORDER[a.verdict.status] - BONUS_ORDER[b.verdict.status] ||
        (b.offer.estValue ?? 0) - (a.offer.estValue ?? 0),
    );

  // People tab: group leaderboard, per-person open cards (honouring shareRankings), and shared offers
  const peopleData: MobilePeopleData = (() => {
    const { leaderboard, cardsByPerson } = groupStandings(
      groupSummaries,
      peopleList,
      groupHidden,
      user.id,
    );
    const groupCardById = new Map((groupCardsInput?.cards ?? []).map((c) => [c.id, c]));
    const sharedOfferCardById = new Map((groupOffersInput?.cards ?? []).map((c) => [c.id, c]));
    const sharedOffersList = groupOffersInput
      ? offersByPerson(
          groupOffersInput.people,
          groupOffersInput.offers,
          user.id,
          today,
          groupOffersInput.cards,
        )
      : [];
    const offersOf = new Map(sharedOffersList.map((x) => [x.id, x]));
    const mineMerchantKeys = onCardMerchantKeys(offers, today);

    const others = peopleList
      .filter((p) => p.id !== user.id && (offersOf.has(p.id) || cardsByPerson.has(p.id)))
      .map((p) => {
        const sharing = !groupHidden.has(p.id);
        const rawPersonCards = cardsByPerson.get(p.id);
        const mappedPersonCards: MobilePersonCard[] | null = rawPersonCards
          ? rawPersonCards.map((c) => {
              const fullCard = groupCardById.get(c.cardId);
              const breakdown =
                fullCard && groupCardsInput
                  ? creditBreakdown(
                      fullCard,
                      groupCardsInput.benefits,
                      groupCardsInput.usage,
                      today,
                    )
                  : { used: [], unused: [] };
              return {
                cardId: c.cardId,
                name: c.name,
                issuer: c.issuer,
                templateKey: c.templateKey,
                style: cardStyle(c.templateKey, c.issuer),
                annualFeeCents: c.annualFeeCents,
                capturedCents: c.capturedCents,
                availableCents: c.availableCents,
                share: c.share,
                place: c.place,
                credits: breakdown,
              };
            })
          : null;

        const rawOffers = offersOf.get(p.id);
        const mappedOffers = rawOffers
          ? (() => {
              const lastPastedOn = rawOffers.lastPastedAt ? dateOf(rawOffers.lastPastedAt) : null;
              const daysAgo = lastPastedOn ? daysBetween(lastPastedOn, today) : null;
              const groups: MobilePersonOfferGroup[] = rawOffers.groups.map((g) => {
                const seenCardIds = new Set<string>();
                const offerCards: { id: string; cardName: string; cardStyle: CardStyle }[] = [];
                for (const item of g.items) {
                  if (!item.cardId || seenCardIds.has(item.cardId)) continue;
                  seenCardIds.add(item.cardId);
                  const sc = sharedOfferCardById.get(item.cardId);
                  if (sc) {
                    offerCards.push({
                      id: sc.id,
                      cardName: sc.name,
                      cardStyle: cardStyle(sc.templateKey, sc.issuer),
                    });
                  }
                }
                return {
                  key: g.key,
                  merchant: g.merchant,
                  details: g.details,
                  maxCents: g.maxCents,
                  rate: g.rate,
                  rateLabel: g.rate !== null ? rateLabel(g.rate) : null,
                  weak: g.rate !== null && g.rate < WEAK_RATE,
                  missingFromMine: !mineMerchantKeys.has(merchantKey(g.merchant)),
                  expiresOn: g.expiresOn,
                  daysLeft: g.expiresOn ? daysBetween(today, g.expiresOn) : null,
                  cards: offerCards,
                };
              });
              return {
                lastPastedOn,
                daysAgo,
                stale: daysAgo === null || daysAgo > STALE_OFFER_DAYS,
                groups,
              };
            })()
          : null;

        return {
          id: p.id,
          firstName: firstName(p.name),
          lastActiveAt: p.lastActiveAt ? new Date(p.lastActiveAt).toISOString() : null,
          sharing,
          cards: mappedPersonCards,
          offers: mappedOffers,
        };
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName));

    return {
      leaderboard: leaderboard.map((s) => ({
        userId: s.userId,
        firstName: s.firstName,
        isMe: s.userId === user.id,
        capturedCents: s.capturedCents,
        availableCents: s.availableCents,
        share: s.share,
      })),
      others,
    };
  })();

  // Year-end checklist
  const yearEndRawExpiring = expiringAtYearEnd(rawStatuses, today);
  const yearEndExpiring = yearEndRawExpiring.map(toMobileStatus);
  const yearEndRenewing = anniversaryUnused(rawStatuses).map(toMobileStatus);
  const heldForTips = openCards.map((c) => ({ name: c.name, templateKey: c.templateKey }));
  const yearEnd: MobileYearEnd = {
    inWindow: inYearEndWindow(today),
    daysLeft: daysBetween(today, yearEndOf(today)),
    expiringCount: yearEndExpiring.length,
    expiringCents: sumRemaining(yearEndExpiring),
    expiring: yearEndExpiring,
    goneForGoodNames: yearEndRawExpiring.filter(endsForGood).map((s) => s.benefit.name),
    renewingCount: yearEndRenewing.length,
    renewingCents: sumRemaining(yearEndRenewing),
    renewing: yearEndRenewing,
    cardNotes: openCards
      .map((c) => ({
        cardId: c.id,
        cardName: c.name,
        cardStyle: c.style,
        notes: notesFor(c.templateKey, today).map((n) => ({ kind: n.kind, text: n.text })),
      }))
      .filter((x) => x.notes.length > 0),
    applyNow: applyTips(APPLY_NOW, heldForTips, today).map((t) => ({ name: t.name, text: t.text })),
    applyLater: applyTips(APPLY_LATER, heldForTips, today).map((t) => ({
      name: t.name,
      text: t.text,
    })),
    hasAmex: openCards.some((c) => /american express/i.test(c.issuer)),
    hasChase: openCards.some((c) => /chase/i.test(c.issuer)),
    source: YEAR_END_SOURCE,
  };

  // Keep cards ordered cleanly: open cards by annual fee desc then name, closed cards by openedOn desc
  const sortedMobileCards = [
    ...[...openCards].sort(
      (a, b) => b.annualFeeCents - a.annualFeeCents || a.name.localeCompare(b.name),
    ),
    ...mobileCards
      .filter((c) => c.closed)
      .sort((a, b) => (b.openedOn ?? "").localeCompare(a.openedOn ?? "")),
  ].map((c) => mobileCardById.get(c.id)!);

  const rules: RuleResult[] = applicationRules(cards, today);

  return {
    user,
    today,
    catalogReviewed: CATALOG_REVIEWED,
    catalog: CATALOG.map((t) => ({
      key: t.key,
      name: t.name,
      issuer: t.issuer,
      business: t.business,
      annualFeeCents: Math.round(t.annualFee * 100),
      style: cardStyle(t.key, t.issuer),
    })),
    overview: {
      expiringThisMonthCents: sumRemaining(thisMonth),
      expiringThisMonthCount: thisMonth.length,
      capturedCents,
      availableCents,
      annualFeesCents,
      soon,
      later,
      activeBonuses,
      spendTargets: activeSpendTargets,
      untrackedSpendTargets,
      catalogUpdateCards,
      expiringOffers,
      feesDue,
    },
    cards: sortedMobileCards,
    offers: {
      strongValueCents,
      weakRateThreshold: WEAK_RATE,
      strong,
      weak,
      past: pastOffers,
      hiddenMerchants,
      cardChecks,
    },
    points: {
      totalPoints,
      totalValueCents,
      valuationSource: VALUATION_SOURCE,
      balances: pointRows,
      redemptions: mappedRedemptions,
      programs: programOptions,
    },
    bonuses: {
      asOf: bonusData.asOf,
      fiveTwentyFour: fiveTwentyFour(cards, today),
      rules,
      offers: bonusRows,
    },
    referrals: {
      mine: myReferrals,
      others: otherReferrals,
      shareableCards: shareable,
    },
    people: peopleData,
    yearEnd,
    settings: {
      digestEnabled: settings.digestEnabled,
      lastDigestOn: settings.lastDigestOn,
      shareRankings,
      lastActiveAt: settings.lastActiveAt ?? null,
    },
  };
}

/* ---- Action payloads & pure validation --------------------------------- */

export type MobileAction =
  | { type: "usage.markUsed"; benefitId: string; periodKey: string }
  | { type: "usage.clearUsed"; benefitId: string; periodKey: string }
  | { type: "usage.logAmount"; benefitId: string; periodKey: string; amountCents: number }
  | { type: "usage.markPastUsed"; benefitId: string }
  | {
      type: "usage.saveStatementCredits";
      cardId: string;
      credits: { date: string; amountCents: number; benefitId: string }[];
    }
  | { type: "statement.preview"; cardId: string; csv: string }
  | {
      type: "card.add";
      templateKey: string | null;
      name: string;
      issuer: string;
      annualFeeCents: number | null;
      openedOn: string | null;
      business: boolean | null;
    }
  | {
      type: "card.update";
      id: string;
      name: string;
      issuer: string;
      annualFeeCents: number;
      openedOn: string | null;
      business: boolean;
      closed: boolean;
    }
  | { type: "card.delete"; id: string }
  | { type: "card.applyTemplate"; id: string; templateKey: string }
  | { type: "card.applyCatalogUpdates"; cardId: string }
  | { type: "card.importSheet"; sheet: string }
  | {
      type: "benefit.add";
      cardId: string;
      name: string;
      cadence: Cadence;
      amountCents: number;
      notes: string;
      enrollRequired: boolean;
      endsOn: string | null;
    }
  | {
      type: "benefit.update";
      id: string;
      name: string;
      cadence: Cadence;
      amountCents: number;
      notes: string;
      enrollRequired: boolean;
      endsOn: string | null;
    }
  | { type: "benefit.setFlag"; id: string; flag: "tracked" | "enrolled"; value: boolean }
  | { type: "benefit.delete"; id: string }
  | { type: "worth.save"; cardId: string; values: Record<string, number | null> }
  | {
      type: "bonus.update";
      cardId: string;
      bonusText: string;
      msrCents: number | null;
      msrDeadline: string | null;
      msrSpentCents: number;
      bonusReceivedOn: string | null;
    }
  | { type: "bonus.setSpent"; cardId: string; spentCents: number }
  | { type: "bonus.markReceived"; cardId: string }
  | { type: "offers.paste"; cardId: string | null; text: string }
  | { type: "offers.markChecked"; cardId: string }
  | { type: "offers.setStatus"; id: string; status: OfferStatus }
  | { type: "offers.setGroupStatus"; ids: string[]; status: "used" | "dismissed" }
  | { type: "offers.restore"; items: { id: string; status: OfferStatus }[] }
  | { type: "offers.hideMerchant"; merchant: string }
  | { type: "offers.unhideMerchant"; merchantKey: string }
  | { type: "offers.delete"; id: string }
  | {
      type: "points.save";
      program: string;
      balance: number;
      centsPerPointX100: number;
      customValue: boolean;
    }
  | { type: "points.importBalances"; balances: string }
  | { type: "points.delete"; id: string }
  | {
      type: "redemption.add";
      program: string;
      points: number;
      cashCents: number;
      feesCents: number;
      redeemedOn: string | null;
      note: string;
    }
  | { type: "redemption.delete"; id: string }
  | {
      type: "referral.add";
      templateKey: string | null;
      cardName: string;
      url: string;
      reward: string;
    }
  | { type: "referral.delete"; id: string }
  | { type: "spendTarget.setSpent"; id: string; spentCents: number }
  | { type: "spendTarget.setTracked"; id: string; tracked: boolean }
  | { type: "settings.setDigest"; enabled: boolean }
  | { type: "settings.setShareRankings"; enabled: boolean }
  | { type: "settings.sendDigestNow" };

/**
 * Compile-time bidirectional contract check: fails `pnpm check` if an action
 * type is added to `@kch/perks-types` without handling it in `mobile-api.ts`
 * (or vice versa).
 */
type ExpectNever<T extends never> = T;
export type AssertMobileActionParity = [
  ExpectNever<Exclude<MobileActionPayload["type"], MobileAction["type"]>>,
  ExpectNever<Exclude<MobileAction["type"], MobileActionPayload["type"]>>,
];

const OFFER_STATUSES = new Set<OfferStatus>(["available", "added", "used", "dismissed"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseBenefitBody(body: Record<string, unknown>):
  | { error: string }
  | {
      values: {
        name: string;
        cadence: Cadence;
        amountCents: number;
        notes: string;
        enrollRequired: boolean;
        endsOn: string | null;
      };
    } {
  const name = str(body.name);
  const cadence = str(body.cadence);
  const amount = parseDollars(str(body.amount) || "0");
  const endsInput = str(body.endsOn);
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
      notes: str(body.notes),
      enrollRequired: Boolean(body.enrollRequired),
      endsOn,
    },
  };
}

/** Validate and normalise a raw JSON action request before touching the database. */
export function parseMobileAction(raw: unknown): { action: MobileAction } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Action body must be a JSON object." };
  }
  const body = raw as Record<string, unknown>;
  const type = str(body.type);

  switch (type) {
    case "usage.markUsed":
    case "usage.clearUsed": {
      const benefitId = str(body.benefitId);
      const periodKey = str(body.periodKey);
      if (!benefitId || !periodKey) return { error: "Benefit and period are required." };
      return { action: { type, benefitId, periodKey } };
    }
    case "usage.logAmount": {
      const benefitId = str(body.benefitId);
      const periodKey = str(body.periodKey);
      const amountCents =
        typeof body.amountCents === "number" &&
        Number.isInteger(body.amountCents) &&
        body.amountCents >= 0
          ? body.amountCents
          : parseDollars(str(body.amount));
      if (!benefitId || !periodKey) return { error: "Benefit and period are required." };
      if (amountCents === null) return { error: "Enter a dollar amount, like 6 or 12.95." };
      return { action: { type, benefitId, periodKey, amountCents } };
    }
    case "usage.markPastUsed": {
      const benefitId = str(body.benefitId);
      if (!benefitId) return { error: "Benefit is required." };
      return { action: { type, benefitId } };
    }
    case "statement.preview": {
      const cardId = str(body.cardId);
      const csv = typeof body.csv === "string" ? body.csv : "";
      if (!cardId) return { error: "Pick the card this statement is for." };
      if (!csv.trim()) return { error: "Paste or choose a CSV statement file." };
      return { action: { type, cardId, csv } };
    }
    case "usage.saveStatementCredits": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Pick the card this statement is for." };
      if (!Array.isArray(body.credits)) {
        return { error: "Could not read the matched credits." };
      }
      const credits = body.credits.slice(0, 2000).map((item) => {
        const r = (item ?? {}) as Record<string, unknown>;
        return {
          date: str(r.date),
          amountCents: Number(r.amountCents),
          benefitId: str(r.benefitId),
        };
      });
      return { action: { type, cardId, credits } };
    }
    case "card.add": {
      const templateKey = str(body.template) || null;
      const name = str(body.name);
      if (!templateKey && !name) {
        return { error: "Pick a card from the list or give it a name." };
      }
      const feeStr = str(body.annualFee);
      const annualFeeCents = feeStr ? parseDollars(feeStr) : null;
      if (feeStr && annualFeeCents === null) {
        return { error: "Annual fee should be a dollar amount, like 95." };
      }
      const openedInput = str(body.openedOn);
      const openedOn = openedInput ? parseSheetDate(openedInput) : null;
      if (openedInput && !openedOn) return { error: "Opened date is not a valid date." };
      return {
        action: {
          type,
          templateKey,
          name,
          issuer: str(body.issuer),
          annualFeeCents,
          openedOn,
          business: typeof body.business === "boolean" ? body.business : null,
        },
      };
    }
    case "card.update": {
      const id = str(body.id);
      const name = str(body.name);
      const fee = parseDollars(str(body.annualFee) || "0");
      const openedInput = str(body.openedOn);
      const openedOn = openedInput ? parseSheetDate(openedInput) : null;
      if (!id) return { error: "Card not found." };
      if (!name) return { error: "Name cannot be empty." };
      if (fee === null) return { error: "Annual fee should be a dollar amount, like 95." };
      if (openedInput && !openedOn) return { error: "Opened date is not a valid date." };
      return {
        action: {
          type,
          id,
          name,
          issuer: str(body.issuer),
          annualFeeCents: fee,
          openedOn,
          business: Boolean(body.business),
          closed: Boolean(body.closed),
        },
      };
    }
    case "card.delete": {
      const id = str(body.id);
      if (!id) return { error: "Card not found." };
      return { action: { type, id } };
    }
    case "card.applyTemplate": {
      const id = str(body.id);
      const templateKey = str(body.template);
      if (!id || !templateKey) return { error: "Card and template are required." };
      return { action: { type, id, templateKey } };
    }
    case "card.applyCatalogUpdates": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Card not found." };
      return { action: { type, cardId } };
    }
    case "card.importSheet": {
      const sheet = typeof body.sheet === "string" ? body.sheet.trim() : "";
      if (!sheet) return { error: "Paste at least one card line." };
      return { action: { type, sheet } };
    }
    case "benefit.add": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Card not found." };
      const parsed = parseBenefitBody(body);
      if ("error" in parsed) return { error: parsed.error };
      return { action: { type, cardId, ...parsed.values } };
    }
    case "benefit.update": {
      const id = str(body.id);
      if (!id) return { error: "Benefit not found." };
      const parsed = parseBenefitBody(body);
      if ("error" in parsed) return { error: parsed.error };
      return { action: { type, id, ...parsed.values } };
    }
    case "benefit.setFlag": {
      const id = str(body.id);
      const flag = str(body.flag);
      if (!id || (flag !== "tracked" && flag !== "enrolled")) {
        return { error: "Benefit and valid flag are required." };
      }
      return { action: { type, id, flag, value: Boolean(body.value) } };
    }
    case "benefit.delete": {
      const id = str(body.id);
      if (!id) return { error: "Benefit not found." };
      return { action: { type, id } };
    }
    case "worth.save": {
      const cardId = str(body.cardId);
      if (
        !cardId ||
        !body.values ||
        typeof body.values !== "object" ||
        Array.isArray(body.values)
      ) {
        return { error: "Card and values are required." };
      }
      const out: Record<string, number | null> = {};
      for (const [benefitId, rawVal] of Object.entries(body.values as Record<string, unknown>)) {
        const s = str(rawVal);
        if (!s) {
          out[benefitId] = null;
          continue;
        }
        const cents = parseDollars(s);
        if (cents === null) return { error: `"${s}" is not a dollar amount.` };
        out[benefitId] = cents;
      }
      return { action: { type, cardId, values: out } };
    }
    case "bonus.update": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Card not found." };
      const msrInput = str(body.msr);
      const msr = msrInput ? parseDollars(msrInput) : null;
      const spent = parseDollars(str(body.spent) || "0");
      const deadlineInput = str(body.deadline);
      const deadline = deadlineInput ? parseSheetDate(deadlineInput) : null;
      const receivedInput = str(body.received);
      const received = receivedInput ? parseSheetDate(receivedInput) : null;
      if (msrInput && msr === null) {
        return { error: "Spend required should be a dollar amount, like 4000." };
      }
      if (spent === null) return { error: "Spent so far should be a dollar amount." };
      if (deadlineInput && !deadline) return { error: "Deadline is not a valid date." };
      if (receivedInput && !received) return { error: "Bonus received is not a valid date." };
      return {
        action: {
          type,
          cardId,
          bonusText: str(body.bonus).slice(0, 80),
          msrCents: msr && msr > 0 ? msr : null,
          msrDeadline: deadline,
          msrSpentCents: spent,
          bonusReceivedOn: received,
        },
      };
    }
    case "bonus.setSpent": {
      const cardId = str(body.cardId);
      const spentCents = parseDollars(str(body.spent));
      if (!cardId) return { error: "Card not found." };
      if (spentCents === null) return { error: "Enter a dollar amount." };
      return { action: { type, cardId, spentCents } };
    }
    case "bonus.markReceived": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Card not found." };
      return { action: { type, cardId } };
    }
    case "offers.paste": {
      const cardId = str(body.cardId) || null;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return { error: "Paste the offers text first." };
      return { action: { type, cardId, text } };
    }
    case "offers.markChecked": {
      const cardId = str(body.cardId);
      if (!cardId) return { error: "Card not found." };
      return { action: { type, cardId } };
    }
    case "offers.setStatus": {
      const id = str(body.id);
      const status = str(body.status) as OfferStatus;
      if (!id || !OFFER_STATUSES.has(status)) return { error: "Valid offer and status required." };
      return { action: { type, id, status } };
    }
    case "offers.setGroupStatus": {
      const status = str(body.status);
      const ids = Array.isArray(body.ids) ? body.ids.map(str).filter(Boolean).slice(0, 50) : [];
      if (ids.length === 0 || (status !== "used" && status !== "dismissed")) {
        return { error: "Offers and status are required." };
      }
      return { action: { type, ids, status } };
    }
    case "offers.restore": {
      if (!Array.isArray(body.items)) return { error: "Items array is required." };
      const items = body.items
        .slice(0, 50)
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          return { id: str(r.id), status: str(r.status) as OfferStatus };
        })
        .filter((i) => i.id && OFFER_STATUSES.has(i.status));
      return { action: { type, items } };
    }
    case "offers.hideMerchant": {
      const merchant = str(body.merchant);
      if (!merchant || !merchantKey(merchant)) return { error: "Merchant name is required." };
      return { action: { type, merchant } };
    }
    case "offers.unhideMerchant": {
      const key = str(body.merchantKey);
      if (!key) return { error: "Merchant key is required." };
      return { action: { type, merchantKey: key } };
    }
    case "offers.delete": {
      const id = str(body.id);
      if (!id) return { error: "Offer is required." };
      return { action: { type, id } };
    }
    case "points.save": {
      const program = normalizeProgram(str(body.program)).slice(0, 80);
      const balance = Math.round(Number(str(body.balance).replace(/[,\s]/g, "")));
      const valuation = resolvePointValuation(program, str(body.cpp));
      if (!program) return { error: "Choose a program." };
      if (!Number.isFinite(balance) || balance < 0) {
        return { error: "Balance should be a number of points." };
      }
      if (!valuation) return { error: "Value should be cents per point, like 1.5." };
      return {
        action: {
          type,
          program,
          balance,
          centsPerPointX100: valuation.centsPerPointX100,
          customValue: valuation.customValue,
        },
      };
    }
    case "points.importBalances": {
      const balances = typeof body.balances === "string" ? body.balances.trim() : "";
      if (!balances) {
        return { error: 'Paste lines like "Amex MR, 270520", one program per line.' };
      }
      return { action: { type, balances } };
    }
    case "points.delete": {
      const id = str(body.id);
      if (!id) return { error: "Balance id is required." };
      return { action: { type, id } };
    }
    case "redemption.add": {
      const program = normalizeProgram(str(body.program)).slice(0, 80);
      const points = Math.round(Number(str(body.points).replace(/[,\s]/g, "")));
      const cashCents = parseDollars(str(body.cash));
      const feesCents = parseDollars(str(body.fees) || "0");
      const dateInput = str(body.date);
      const redeemedOn = dateInput ? parseSheetDate(dateInput) : null;
      if (!program) return { error: "Choose a program." };
      if (!Number.isFinite(points) || points <= 0) {
        return { error: "Points should be a positive number." };
      }
      if (cashCents === null || cashCents <= 0) {
        return { error: "Cash price should be a dollar amount." };
      }
      if (feesCents === null) return { error: "Taxes and fees should be a dollar amount." };
      if (dateInput && !redeemedOn) return { error: "Date is not valid." };
      return {
        action: {
          type,
          program,
          points,
          cashCents,
          feesCents,
          redeemedOn,
          note: str(body.note).slice(0, 120),
        },
      };
    }
    case "redemption.delete": {
      const id = str(body.id);
      if (!id) return { error: "Redemption id is required." };
      return { action: { type, id } };
    }
    case "referral.add": {
      const choice = str(body.card);
      const template = getTemplate(choice);
      const cardName = (template?.name ?? str(body.cardName)).slice(0, 120);
      const url = str(body.url);
      if (!cardName) return { error: "Choose the card the link is for." };
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") throw new Error();
      } catch {
        return { error: "Paste the full referral link, starting with https://" };
      }
      return {
        action: {
          type,
          templateKey: template?.key ?? null,
          cardName,
          url: url.slice(0, 500),
          reward: str(body.reward).slice(0, 80),
        },
      };
    }
    case "referral.delete": {
      const id = str(body.id);
      if (!id) return { error: "Referral id is required." };
      return { action: { type, id } };
    }
    case "spendTarget.setSpent": {
      const id = str(body.id);
      const spentCents = parseDollars(str(body.spent));
      if (!id) return { error: "Spend goal is required." };
      if (spentCents === null) return { error: "Enter a dollar amount." };
      return { action: { type, id, spentCents } };
    }
    case "spendTarget.setTracked": {
      const id = str(body.id);
      if (!id || typeof body.tracked !== "boolean") {
        return { error: "Spend goal and tracked flag are required." };
      }
      return { action: { type, id, tracked: body.tracked } };
    }
    case "settings.setDigest": {
      if (typeof body.enabled !== "boolean") return { error: "Enabled flag must be boolean." };
      return { action: { type, enabled: body.enabled } };
    }
    case "settings.setShareRankings": {
      if (typeof body.enabled !== "boolean") return { error: "Enabled flag must be boolean." };
      return { action: { type, enabled: body.enabled } };
    }
    case "settings.sendDigestNow":
      return { action: { type } };
    default:
      return { error: `Unknown action type: ${type || "(empty)"}.` };
  }
}

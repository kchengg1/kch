import bonusData from "../data/signup-bonuses.json";
import { cardStyle, type CardStyle } from "./card-style";
import { CATALOG, CATALOG_REVIEWED, onStatement } from "./catalog";
import { checkEligibility, fiveTwentyFour, type BonusOffer, type Verdict } from "./eligibility";
import { parseDollars } from "./money";
import { msrStatus, type MsrStatus } from "./msr";
import { groupOffers, merchantKey } from "./offer-groups";
import { isWeakOffer, offerReturn, rateLabel, WEAK_RATE } from "./offer-value";
import {
  CADENCE_LABEL,
  daysBetween,
  isCadence,
  periodsThisYear,
  shortLabel,
  todayIn,
  type Cadence,
} from "./periods";
import {
  PROGRAMS,
  balanceValueCents,
  checkRedemption,
  defaultCentsPerPoint,
  normalizeProgram,
  type RedemptionCheck,
} from "./points";
import { applicationRules, type RuleResult } from "./rules";
import { parseSheetDate } from "./sheet-import";
import {
  actionable,
  buildStatuses,
  indexUsage,
  summarizeCards,
  usedIn,
  type BenefitStatus,
} from "./summary";
import { cardWorth, faceValueCents, myValueCents } from "./worth";

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
  settings: { digestEnabled: boolean; lastDigestOn: string | null };
  dateOf?: (at: Date) => string;
};

export type MobileUsageChip = {
  key: string;
  label: string;
  shortLabel: string;
  start: string;
  end: string;
  logged: boolean;
  usedCents: number;
  full: boolean;
  partial: boolean;
  future: boolean;
  current: boolean;
};

export type MobileBenefit = MobileBenefitInput & {
  cadence: Cadence;
  cadenceLabel: string;
  expired: boolean;
  inApp: boolean;
  faceYearlyCents: number;
  effectiveWorthCents: number;
  periods: MobileUsageChip[];
  openPastCount: number;
};

export type MobileCard = {
  id: string;
  name: string;
  issuer: string;
  templateKey: string | null;
  style: CardStyle;
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
  offersCheckedOn: string | null;
  availableCents: number;
  capturedCents: number;
  nextFeeOn: string | null;
  msr: MsrStatus | null;
  worth: { advertisedCents: number; worthCents: number; netCents: number };
  benefits: MobileBenefit[];
};

export type MobileOfferGroup = {
  key: string;
  merchant: string;
  details: string;
  valueCents: number | null;
  maxCents: number | null;
  rate: number | null;
  rateLabel: string | null;
  weak: boolean;
  expiresOn: string | null;
  daysLeft: number | null;
  items: {
    id: string;
    cardId: string | null;
    cardName: string;
    cardStyle: CardStyle;
    status: string;
  }[];
};

export type MobileBootstrap = {
  user: { id: string; name: string; email: string };
  today: string;
  catalogReviewed: string;
  catalog: {
    key: string;
    name: string;
    issuer: string;
    business: boolean;
    annualFeeCents: number;
    style: CardStyle;
  }[];
  overview: {
    expiringThisMonthCents: number;
    expiringThisMonthCount: number;
    capturedCents: number;
    availableCents: number;
    annualFeesCents: number;
    soon: (BenefitStatus & { cardStyle: CardStyle })[];
    later: (BenefitStatus & { cardStyle: CardStyle })[];
    activeBonuses: {
      cardId: string;
      cardName: string;
      cardStyle: CardStyle;
      bonusText: string;
      msr: MsrStatus;
    }[];
    expiringOffers: MobileOfferGroup[];
    feesDue: {
      cardId: string;
      cardName: string;
      cardStyle: CardStyle;
      annualFeeCents: number;
      nextFeeOn: string;
      capturedCents: number;
      worthCents: number;
      netCents: number;
    }[];
  };
  cards: MobileCard[];
  offers: {
    strongValueCents: number;
    weakRateThreshold: number;
    strong: MobileOfferGroup[];
    weak: MobileOfferGroup[];
    past: MobileOfferInput[];
    hiddenMerchants: MobileHiddenMerchantInput[];
    cardChecks: {
      cardId: string;
      cardName: string;
      cardStyle: CardStyle;
      checkedOn: string | null;
      daysAgo: number | null;
      stale: boolean;
    }[];
  };
  points: {
    totalPoints: number;
    totalValueCents: number;
    balances: (MobilePointsInput & { valueCents: number })[];
    redemptions: (MobileRedemptionInput & {
      centsPerPoint: number;
      targetCentsPerPoint: number;
      check: RedemptionCheck | null;
    })[];
    programs: { program: string; centsPerPoint: number }[];
  };
  bonuses: {
    asOf: string;
    fiveTwentyFour: number;
    rules: RuleResult[];
    offers: { offer: BonusOffer; verdict: Verdict }[];
  };
  settings: {
    digestEnabled: boolean;
    lastDigestOn: string | null;
  };
};

const BONUS_ORDER: Record<Verdict["status"], number> = {
  eligible: 0,
  caution: 1,
  ineligible: 2,
};

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
    dateOf = (at: Date) => todayIn("America/New_York", at),
  } = input;

  const usageIndex = indexUsage(usage);
  const summaries = summarizeCards(cards, benefits, usage, today);
  const summaryById = new Map(summaries.map((s) => [s.card.id, s]));
  const cardById = new Map(cards.map((c) => [c.id, c]));

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
      benefits: mappedBenefits,
    };
  });

  const mobileCardById = new Map(mobileCards.map((c) => [c.id, c]));
  const openCards = mobileCards.filter((c) => !c.closed);

  // Overview calculations
  const todo = actionable(buildStatuses(cards, benefits, usage, today)).map((s) => ({
    ...s,
    cardStyle: cardStyle(s.card.templateKey, s.card.issuer),
  }));
  const soon = todo.filter((s) => (s.daysLeft ?? 0) <= SOON_DAYS);
  const later = todo.filter((s) => (s.daysLeft ?? 0) > SOON_DAYS);
  const thisMonth = todo.filter((s) => s.deadline && s.deadline.slice(0, 7) === today.slice(0, 7));
  const sumRemaining = (list: typeof todo) => list.reduce((n, s) => n + s.remainingCents, 0);

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
    (o) => !(o.status === "available" || o.status === "added") || isExpiredOffer(o),
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
    .map((p) => ({
      ...p,
      valueCents: Math.round(balanceValueCents(p.balance, p.centsPerPointX100) / 100) * 100,
    }))
    .sort((a, b) => b.valueCents - a.valueCents);
  const totalValueCents = pointRows.reduce((n, r) => n + r.valueCents, 0);
  const totalPoints = pointRows.reduce((n, r) => n + r.balance, 0);
  const valueByProgram = new Map(points.map((p) => [p.program, p.centsPerPointX100 / 100]));
  const programOptions = [
    ...pointRows.map((r) => ({ program: r.program, centsPerPoint: r.centsPerPointX100 / 100 })),
    ...PROGRAMS.filter((p) => !valueByProgram.has(p)).map((p) => ({
      program: p,
      centsPerPoint: defaultCentsPerPoint(p),
    })),
  ];
  const mappedRedemptions = [...redemptions].reverse().map((r) => {
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

  // Sign-up bonus eligibility & issuer rules
  const bonusRows = (bonusData.offers as BonusOffer[])
    .map((offer) => ({ offer, verdict: checkEligibility(offer, cards, today) }))
    .sort(
      (a, b) =>
        BONUS_ORDER[a.verdict.status] - BONUS_ORDER[b.verdict.status] ||
        (b.offer.estValue ?? 0) - (a.offer.estValue ?? 0),
    );

  // Keep cards ordered cleanly: open cards by annual fee desc then name, closed cards by openedOn desc
  const sortedMobileCards = [
    ...[...openCards].sort(
      (a, b) => b.annualFeeCents - a.annualFeeCents || a.name.localeCompare(b.name),
    ),
    ...mobileCards
      .filter((c) => c.closed)
      .sort((a, b) => (b.openedOn ?? "").localeCompare(a.openedOn ?? "")),
  ].map((c) => mobileCardById.get(c.id)!);

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
      balances: pointRows,
      redemptions: mappedRedemptions,
      programs: programOptions,
    },
    bonuses: {
      asOf: bonusData.asOf,
      fiveTwentyFour: fiveTwentyFour(cards, today),
      rules: applicationRules(cards, today),
      offers: bonusRows,
    },
    settings,
  };
}

/* ---- Action payloads & pure validation --------------------------------- */

export type OfferStatus = "available" | "added" | "used" | "dismissed";

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
  | { type: "settings.setDigest"; enabled: boolean }
  | { type: "settings.sendDigestNow" };

export type StatementPreviewPayload = {
  charges: number;
  benefits: { id: string; name: string }[];
  rows: {
    date: string;
    description: string;
    amountCents: number;
    suggestedBenefitId: string | null;
  }[];
};

export type MobileActionResponse = {
  ok: true;
  message?: string;
  cardId?: string;
  statementPreview?: StatementPreviewPayload;
  bootstrap?: MobileBootstrap;
};

const OFFER_STATUSES = new Set<OfferStatus>(["available", "added", "used", "dismissed"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseCpp(value: string): number | null {
  const n = Number(value.replace(/[¢\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? Math.round(n * 100) : null;
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
      const cppInput = str(body.cpp);
      const cpp = cppInput ? parseCpp(cppInput) : Math.round(defaultCentsPerPoint(program) * 100);
      if (!program) return { error: "Choose a program." };
      if (!Number.isFinite(balance) || balance < 0) {
        return { error: "Balance should be a number of points." };
      }
      if (cpp === null) return { error: "Value should be cents per point, like 1.7." };
      return { action: { type, program, balance, centsPerPointX100: cpp } };
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
    case "settings.setDigest": {
      if (typeof body.enabled !== "boolean") return { error: "Enabled flag must be boolean." };
      return { action: { type, enabled: body.enabled } };
    }
    case "settings.sendDigestNow":
      return { action: { type } };
    default:
      return { error: `Unknown action type: ${type || "(empty)"}.` };
  }
}

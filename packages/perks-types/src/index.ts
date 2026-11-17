/**
 * Canonical mobile API contract shared between `@kch/perks` (Next.js server)
 * and `@kch/perks-ios` (Expo React Native client).
 *
 * Pure TypeScript type declarations only (zero runtime imports), so both apps
 * validate exact wire-compatibility via `pnpm check` without bundler coupling.
 */

export type Cadence =
  "monthly" | "quarterly" | "semiannual" | "annual" | "anniversary" | "quadrennial" | "perk";

export type OfferStatus = "available" | "added" | "used" | "dismissed";

export type OfferSortKey = "return" | "value" | "expiry";

export type TabKey = "overview" | "cards" | "offers" | "points" | "people";

export type CardsSubTabKey = "cards" | "pick" | "bonuses";

export type CardStyle = {
  from: string;
  to: string;
  chip: string;
  label: string;
};

export type Period = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export type CardRow = {
  id: string;
  name: string;
  annualFeeCents: number;
  openedOn: string | null;
  closed: boolean;
  templateKey?: string | null;
  issuer?: string;
};

export type BenefitRow = {
  id: string;
  cardId: string;
  name: string;
  cadence: string;
  amountCents: number;
  notes: string;
  enrollRequired: boolean;
  enrolled: boolean;
  tracked: boolean;
  endsOn: string | null;
  sortOrder: number;
};

export type BenefitStatus = {
  benefit: BenefitRow;
  card: CardRow;
  cadence: Cadence;
  period: Period | null;
  usedCents: number;
  remainingCents: number;
  done: boolean;
  daysLeft: number | null;
  deadline: string | null;
  cardStyle: CardStyle;
};

export type MsrStatus = {
  requiredCents: number;
  spentCents: number;
  leftCents: number;
  daysLeft: number | null;
  perDayCents: number | null;
  state: "active" | "met" | "missed" | "received";
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

export type MobileBenefit = {
  id: string;
  cardId: string;
  name: string;
  cadence: Cadence;
  cadenceLabel: string;
  amountCents: number;
  notes: string;
  enrollRequired: boolean;
  enrolled: boolean;
  myValueCents: number | null;
  tracked: boolean;
  endsOn: string | null;
  sortOrder: number;
  expired: boolean;
  inApp: boolean;
  faceYearlyCents: number;
  effectiveWorthCents: number;
  periods: MobileUsageChip[];
  openPastCount: number;
};

export type MobileCardCatalogUpdates = {
  count: number;
  added: string[];
  changed: string[];
  removed: string[];
};

export type MobileCardStanding = {
  cardId: string;
  userId: string;
  firstName: string;
  isMe: boolean;
  capturedCents: number;
  availableCents: number;
  share: number;
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
  catalogUpdates: MobileCardCatalogUpdates;
  standings: MobileCardStanding[];
  benefits: MobileBenefit[];
};

export type MobileOfferItem = {
  id: string;
  cardId: string | null;
  cardName: string;
  cardStyle: CardStyle;
  status: string;
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
  items: MobileOfferItem[];
};

export type MobileOfferRow = {
  id: string;
  cardId: string | null;
  merchant: string;
  details: string;
  valueCents: number | null;
  expiresOn: string | null;
  status: string;
};

export type MobileHiddenMerchant = {
  merchantKey: string;
  label: string;
};

export type MobilePointsBalance = {
  id: string;
  program: string;
  balance: number;
  centsPerPointX100: number;
  valueCents: number;
};

export type RedemptionCheck = {
  centsPerPoint: number;
  verdict: "points" | "cash" | "even";
  gainCents: number;
};

export type MobileRedemption = {
  id: string;
  program: string;
  redeemedOn: string;
  points: number;
  feesCents: number;
  cashCents: number;
  note: string;
  centsPerPoint: number;
  targetCentsPerPoint: number;
  check: RedemptionCheck | null;
};

export type RuleResult = {
  id: string;
  title: string;
  detail: string;
  status: "clear" | "wait";
  until?: string;
};

export type BonusOffer = {
  id: string;
  card: string;
  issuer: string;
  business: boolean;
  bonus: string;
  spend: string | null;
  annualFee: number;
  estValue: number | null;
  note?: string;
  url?: string;
  match: string;
  templateKey?: string;
  noLifetimeLanguage?: boolean;
  elevated?: boolean;
};

export type BonusVerdict = {
  status: "eligible" | "caution" | "ineligible";
  reasons: string[];
};

export type CatalogEntry = {
  key: string;
  name: string;
  issuer: string;
  business: boolean;
  annualFeeCents: number;
  style: CardStyle;
};

export type MobileSpendTarget = {
  id: string;
  cardId: string;
  cardName: string;
  cardStyle: CardStyle;
  name: string;
  reward: string;
  targetCents: number;
  spentCents: number;
  tracked: boolean;
};

export type MobileReferral = {
  id: string;
  userId: string;
  firstName: string;
  templateKey: string | null;
  cardName: string;
  cardStyle: CardStyle;
  url: string;
  reward: string;
};

export type MobileShareableCard = {
  cardId: string;
  name: string;
  templateKey: string;
  style: CardStyle;
};

export type MobileLeaderboardRow = {
  userId: string;
  firstName: string;
  isMe: boolean;
  capturedCents: number;
  availableCents: number;
  share: number;
};

export type MobileCreditBreakdownLine = {
  benefitId: string;
  name: string;
  usedCents: number;
  availableCents: number;
  leftCents: number;
};

export type MobilePersonCard = {
  cardId: string;
  name: string;
  issuer: string;
  templateKey: string | null;
  style: CardStyle;
  annualFeeCents: number;
  capturedCents: number;
  availableCents: number;
  share: number;
  place: { rank: number; of: number } | null;
  credits: {
    used: MobileCreditBreakdownLine[];
    unused: MobileCreditBreakdownLine[];
  };
};

export type MobilePersonOfferGroup = {
  key: string;
  merchant: string;
  details: string;
  maxCents: number | null;
  rate: number | null;
  rateLabel: string | null;
  weak: boolean;
  missingFromMine: boolean;
  expiresOn: string | null;
  daysLeft: number | null;
  cards: {
    id: string;
    cardName: string;
    cardStyle: CardStyle;
  }[];
};

export type MobilePersonEntry = {
  id: string;
  firstName: string;
  /** ISO timestamp of when they were last active in the app, or null if never recorded. */
  lastActiveAt: string | null;
  sharing: boolean;
  cards: MobilePersonCard[] | null;
  offers: {
    lastPastedOn: string | null;
    daysAgo: number | null;
    stale: boolean;
    groups: MobilePersonOfferGroup[];
  } | null;
};

export type MobilePeopleData = {
  leaderboard: MobileLeaderboardRow[];
  others: MobilePersonEntry[];
};

export type MobileYearEndNote = {
  kind: "cap" | "goal" | "change" | "info";
  text: string;
};

export type MobileYearEnd = {
  inWindow: boolean;
  daysLeft: number;
  expiringCount: number;
  expiringCents: number;
  expiring: BenefitStatus[];
  goneForGoodNames: string[];
  renewingCount: number;
  renewingCents: number;
  renewing: BenefitStatus[];
  cardNotes: {
    cardId: string;
    cardName: string;
    cardStyle: CardStyle;
    notes: MobileYearEndNote[];
  }[];
  applyNow: { name: string; text: string }[];
  applyLater: { name: string; text: string }[];
  hasAmex: boolean;
  hasChase: boolean;
  source: { title: string; url: string };
};

export type MobileBootstrap = {
  user: { id: string; name: string; email: string };
  today: string;
  catalogReviewed: string;
  catalog: CatalogEntry[];
  overview: {
    expiringThisMonthCents: number;
    expiringThisMonthCount: number;
    capturedCents: number;
    availableCents: number;
    annualFeesCents: number;
    soon: BenefitStatus[];
    later: BenefitStatus[];
    activeBonuses: {
      cardId: string;
      cardName: string;
      cardStyle: CardStyle;
      bonusText: string;
      msr: MsrStatus;
    }[];
    spendTargets: MobileSpendTarget[];
    untrackedSpendTargets: MobileSpendTarget[];
    catalogUpdateCards: {
      cardId: string;
      cardName: string;
      cardStyle: CardStyle;
      count: number;
      summary: string[];
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
    past: MobileOfferRow[];
    hiddenMerchants: MobileHiddenMerchant[];
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
    balances: MobilePointsBalance[];
    redemptions: MobileRedemption[];
    programs: { program: string; centsPerPoint: number }[];
  };
  bonuses: {
    asOf: string;
    fiveTwentyFour: number;
    rules: RuleResult[];
    offers: {
      offer: BonusOffer;
      verdict: BonusVerdict;
      friendReferrals: MobileReferral[];
    }[];
  };
  referrals: {
    mine: MobileReferral[];
    others: MobileReferral[];
    shareableCards: MobileShareableCard[];
  };
  people: MobilePeopleData;
  yearEnd: MobileYearEnd;
  settings: {
    digestEnabled: boolean;
    lastDigestOn: string | null;
    shareRankings: boolean;
    /** ISO timestamp of the user's last authenticated activity, or null if never recorded. */
    lastActiveAt: string | null;
  };
};

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

export type MobileActionPayload =
  | { type: "usage.markUsed"; benefitId: string; periodKey: string }
  | { type: "usage.clearUsed"; benefitId: string; periodKey: string }
  | { type: "usage.logAmount"; benefitId: string; periodKey: string; amount: string }
  | { type: "usage.markPastUsed"; benefitId: string }
  | { type: "statement.preview"; cardId: string; csv: string }
  | {
      type: "usage.saveStatementCredits";
      cardId: string;
      credits: { date: string; amountCents: number; benefitId: string }[];
    }
  | {
      type: "card.add";
      template?: string;
      name?: string;
      issuer?: string;
      annualFee?: string;
      openedOn?: string;
      business?: boolean;
    }
  | {
      type: "card.update";
      id: string;
      name: string;
      issuer?: string;
      annualFee?: string;
      openedOn?: string;
      business?: boolean;
      closed?: boolean;
    }
  | { type: "card.delete"; id: string }
  | { type: "card.applyTemplate"; id: string; template: string }
  | { type: "card.applyCatalogUpdates"; cardId: string }
  | { type: "card.importSheet"; sheet: string }
  | {
      type: "benefit.add";
      cardId: string;
      name: string;
      cadence: Cadence;
      amount?: string;
      notes?: string;
      enrollRequired?: boolean;
      endsOn?: string;
    }
  | {
      type: "benefit.update";
      id: string;
      name: string;
      cadence: Cadence;
      amount?: string;
      notes?: string;
      enrollRequired?: boolean;
      endsOn?: string;
    }
  | { type: "benefit.setFlag"; id: string; flag: "tracked" | "enrolled"; value: boolean }
  | { type: "benefit.delete"; id: string }
  | { type: "worth.save"; cardId: string; values: Record<string, string> }
  | {
      type: "bonus.update";
      cardId: string;
      bonus?: string;
      msr?: string;
      deadline?: string;
      spent?: string;
      received?: string;
    }
  | { type: "bonus.setSpent"; cardId: string; spent: string }
  | { type: "bonus.markReceived"; cardId: string }
  | { type: "offers.paste"; cardId?: string; text: string }
  | { type: "offers.setStatus"; id: string; status: OfferStatus }
  | { type: "offers.setGroupStatus"; ids: string[]; status: "used" | "dismissed" }
  | { type: "offers.restore"; items: { id: string; status: OfferStatus }[] }
  | { type: "offers.hideMerchant"; merchant: string }
  | { type: "offers.unhideMerchant"; merchantKey: string }
  | { type: "offers.delete"; id: string }
  | { type: "points.save"; program: string; balance: string; cpp?: string }
  | { type: "points.importBalances"; balances: string }
  | { type: "points.delete"; id: string }
  | {
      type: "redemption.add";
      program: string;
      points: string;
      cash: string;
      fees?: string;
      date?: string;
      note?: string;
    }
  | { type: "redemption.delete"; id: string }
  | {
      type: "referral.add";
      card?: string;
      cardName?: string;
      url: string;
      reward?: string;
    }
  | { type: "referral.delete"; id: string }
  | { type: "spendTarget.setSpent"; id: string; spent: string }
  | { type: "spendTarget.setTracked"; id: string; tracked: boolean }
  | { type: "settings.setDigest"; enabled: boolean }
  | { type: "settings.setShareRankings"; enabled: boolean }
  | { type: "settings.sendDigestNow" };

export type MobileActionResponse = {
  ok: true;
  message?: string;
  cardId?: string;
  statementPreview?: StatementPreviewPayload;
  bootstrap?: MobileBootstrap;
};

import { describe, expect, it } from "vitest";
import {
  buildMobileBootstrap,
  parseMobileAction,
  type MobileBenefitInput,
  type MobileBootstrapInput,
  type MobileCardInput,
} from "./mobile-api";

const TODAY = "2026-11-15";

const card = (over: Partial<MobileCardInput> = {}): MobileCardInput => ({
  id: "gold",
  name: "Amex Gold",
  issuer: "American Express",
  templateKey: "amex-gold",
  business: false,
  annualFeeCents: 32500,
  openedOn: "2025-12-01",
  closedOn: null,
  closed: false,
  msrCents: 600000,
  msrDeadline: "2026-12-15",
  msrSpentCents: 150000,
  bonusText: "90,000 points",
  bonusReceivedOn: null,
  offersCheckedAt: new Date("2026-11-15T15:00:00Z"),
  ...over,
});

const benefit = (over: Partial<MobileBenefitInput> = {}): MobileBenefitInput => ({
  id: "uber",
  cardId: "gold",
  name: "Uber Cash",
  cadence: "monthly",
  amountCents: 1000,
  notes: "Auto-loads",
  enrollRequired: false,
  enrolled: false,
  myValueCents: null,
  tracked: true,
  endsOn: null,
  sortOrder: 0,
  ...over,
});

const baseInput = (over: Partial<MobileBootstrapInput> = {}): MobileBootstrapInput => ({
  user: { id: "u1", name: "Sam Owner", email: "owner@example.com" },
  today: TODAY,
  cards: [card()],
  benefits: [
    benefit(),
    benefit({ id: "dining", name: "Dining credit", amountCents: 1000, sortOrder: 1 }),
  ],
  usage: [
    { benefitId: "uber", periodKey: "2026-10", usedCents: 1000 },
    { benefitId: "dining", periodKey: "2026-11", usedCents: 400 },
  ],
  offers: [
    {
      id: "o1",
      cardId: "gold",
      merchant: "lululemon",
      details: "Spend $150 or more, get $30 back",
      valueCents: 3000,
      expiresOn: "2026-11-20",
      status: "available",
    },
    {
      id: "o2",
      cardId: "gold",
      merchant: "dyson.com",
      details: "Earn 2% back on purchases, up to a total of $250",
      valueCents: 25000,
      expiresOn: "2026-12-31",
      status: "available",
    },
    {
      id: "o3",
      cardId: "gold",
      merchant: "Hidden Co",
      details: "Spend $50 or more, get $20 back",
      valueCents: 2000,
      expiresOn: "2026-11-20",
      status: "available",
    },
  ],
  hiddenMerchants: [{ merchantKey: "hidden co", label: "Hidden Co" }],
  points: [
    {
      id: "p1",
      program: "American Express Membership Rewards",
      balance: 100_000,
      centsPerPointX100: 200,
    },
  ],
  redemptions: [
    {
      id: "r1",
      program: "American Express Membership Rewards",
      redeemedOn: "2026-10-01",
      points: 50_000,
      feesCents: 5000,
      cashCents: 155_000,
      note: "Tokyo flight",
    },
  ],
  settings: { digestEnabled: true, lastDigestOn: null },
  dateOf: () => TODAY,
  ...over,
});

describe("buildMobileBootstrap", () => {
  it("computes overview credits, upcoming fees, active bonuses, and expiring offers", () => {
    const snap = buildMobileBootstrap(baseInput());
    expect(snap.overview.expiringThisMonthCents).toBe(1600);
    expect(snap.overview.expiringThisMonthCount).toBe(2);
    expect(snap.overview.capturedCents).toBe(1400);
    expect(snap.overview.availableCents).toBe(24_000);
    expect(snap.overview.annualFeesCents).toBe(32_500);
    expect(snap.overview.activeBonuses).toHaveLength(1);
    expect(snap.overview.activeBonuses[0]?.msr.leftCents).toBe(450_000);
    expect(snap.overview.expiringOffers.map((o) => o.merchant)).toEqual(["lululemon"]);
    expect(snap.overview.feesDue[0]?.nextFeeOn).toBe("2026-12-01");
  });

  it("marks in-app credits, period usage chips, and open past counts on card benefits", () => {
    const snap = buildMobileBootstrap(baseInput());
    const goldCard = snap.cards.find((c) => c.id === "gold")!;
    const uber = goldCard.benefits.find((b) => b.id === "uber")!;
    const dining = goldCard.benefits.find((b) => b.id === "dining")!;
    expect(uber.inApp).toBe(true);
    expect(dining.inApp).toBe(false);
    expect(uber.periods).toHaveLength(12);
    // Jan..Oct = 10 past months, Oct is logged -> 9 open past periods
    expect(uber.openPastCount).toBe(9);
    const nov = dining.periods.find((p) => p.key === "2026-11")!;
    expect(nov).toMatchObject({ partial: true, full: false, current: true, usedCents: 400 });
  });

  it("separates strong and weak offers and filters hidden merchants", () => {
    const snap = buildMobileBootstrap(baseInput());
    expect(snap.offers.strong.map((o) => o.merchant)).toEqual(["lululemon"]);
    expect(snap.offers.weak.map((o) => o.merchant)).toEqual(["dyson.com"]);
    expect(snap.offers.cardChecks[0]).toMatchObject({
      cardId: "gold",
      checkedOn: TODAY,
      daysAgo: 0,
      stale: false,
    });
  });

  it("computes points portfolio totals, redemption verdicts, and 5/24 status", () => {
    const snap = buildMobileBootstrap(baseInput());
    expect(snap.points.totalPoints).toBe(100_000);
    expect(snap.points.totalValueCents).toBe(200_000);
    expect(snap.points.redemptions[0]?.centsPerPoint).toBe(3);
    expect(snap.points.redemptions[0]?.check?.verdict).toBe("points");
    expect(snap.bonuses.fiveTwentyFour).toBe(1);
    expect(snap.catalog.length).toBeGreaterThan(10);
  });
});

describe("parseMobileAction", () => {
  it("parses dollar inputs into integer cents and normalises dates", () => {
    expect(
      parseMobileAction({
        type: "usage.logAmount",
        benefitId: "b1",
        periodKey: "2026-11",
        amount: "$6.50",
      }),
    ).toEqual({
      action: {
        type: "usage.logAmount",
        benefitId: "b1",
        periodKey: "2026-11",
        amountCents: 650,
      },
    });

    expect(
      parseMobileAction({
        type: "card.add",
        template: "amex-gold",
        openedOn: "3/15/2025",
      }),
    ).toEqual({
      action: {
        type: "card.add",
        templateKey: "amex-gold",
        name: "",
        issuer: "",
        annualFeeCents: null,
        openedOn: "2025-03-15",
        business: null,
      },
    });

    expect(
      parseMobileAction({
        type: "points.save",
        program: "Amex MR",
        balance: "270,520",
      }),
    ).toEqual({
      action: {
        type: "points.save",
        program: "American Express Membership Rewards",
        balance: 270_520,
        centsPerPointX100: 200,
      },
    });
  });

  it("rejects malformed payloads with clear errors", () => {
    expect(parseMobileAction(null)).toEqual({ error: "Action body must be a JSON object." });
    expect(parseMobileAction({ type: "card.add" })).toEqual({
      error: "Pick a card from the list or give it a name.",
    });
    expect(
      parseMobileAction({
        type: "benefit.add",
        cardId: "c1",
        name: "Test",
        cadence: "weekly",
      }),
    ).toEqual({ error: "Choose how often the benefit resets." });
    expect(parseMobileAction({ type: "unknown.op" })).toEqual({
      error: "Unknown action type: unknown.op.",
    });
  });
});

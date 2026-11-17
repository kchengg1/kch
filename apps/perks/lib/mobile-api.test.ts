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
  settings: { digestEnabled: true, lastDigestOn: null, shareRankings: true },
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

  it("shapes People standings, honours shareRankings privacy, and flags missing offers", () => {
    const snap = buildMobileBootstrap(
      baseInput({
        groupOffers: {
          people: [
            { id: "u1", name: "Sam Owner" },
            { id: "u2", name: "Alex Friend" },
            { id: "u3", name: "Jordan Private" },
          ],
          offers: [
            {
              id: "o1",
              userId: "u1",
              cardId: "gold",
              merchant: "lululemon",
              details: "Spend $150 or more, get $30 back",
              valueCents: 3000,
              expiresOn: "2026-11-20",
              status: "available",
            },
            {
              id: "o-alex",
              userId: "u2",
              cardId: "alex-gold",
              merchant: "Dell Technologies",
              details: "Spend $200 or more, get $50 back",
              valueCents: 5000,
              expiresOn: "2026-12-10",
              status: "available",
            },
            {
              id: "o-jordan",
              userId: "u3",
              cardId: "jordan-plat",
              merchant: "lululemon",
              details: "Spend $100, get $20 back",
              valueCents: 2000,
              expiresOn: "2026-12-05",
              status: "available",
            },
          ],
          cards: [
            {
              id: "gold",
              name: "Amex Gold",
              issuer: "American Express",
              templateKey: "amex-gold",
              userId: "u1",
              offersCheckedAt: new Date("2026-11-15T15:00:00Z"),
            },
            {
              id: "alex-gold",
              name: "Amex Gold",
              issuer: "American Express",
              templateKey: "amex-gold",
              userId: "u2",
              offersCheckedAt: new Date("2026-11-14T15:00:00Z"),
            },
            {
              id: "jordan-plat",
              name: "Amex Platinum",
              issuer: "American Express",
              templateKey: "amex-platinum",
              userId: "u3",
              offersCheckedAt: null,
            },
          ],
        },
        groupCards: {
          cards: [
            {
              id: "gold",
              userId: "u1",
              name: "Amex Gold",
              issuer: "American Express",
              templateKey: "amex-gold",
              annualFeeCents: 32500,
              openedOn: "2025-12-01",
              closed: false,
            },
            {
              id: "alex-gold",
              userId: "u2",
              name: "Amex Gold",
              issuer: "American Express",
              templateKey: "amex-gold",
              annualFeeCents: 32500,
              openedOn: "2025-06-01",
              closed: false,
            },
            {
              id: "jordan-plat",
              userId: "u3",
              name: "Amex Platinum",
              issuer: "American Express",
              templateKey: "amex-platinum",
              annualFeeCents: 69500,
              openedOn: "2025-01-01",
              closed: false,
            },
          ],
          benefits: [
            benefit(),
            benefit({ id: "alex-uber", cardId: "alex-uber-card-mismatch" }),
            benefit({ id: "alex-dining", cardId: "alex-gold", name: "Dining", amountCents: 1000 }),
            benefit({
              id: "jordan-uber",
              cardId: "jordan-plat",
              name: "Uber Cash",
              amountCents: 1500,
            }),
          ],
          usage: [
            { benefitId: "uber", periodKey: "2026-10", usedCents: 1000 },
            { benefitId: "alex-dining", periodKey: "2026-10", usedCents: 1000 },
            { benefitId: "alex-dining", periodKey: "2026-11", usedCents: 1000 },
            { benefitId: "jordan-uber", periodKey: "2026-11", usedCents: 1500 },
          ],
          // Jordan opted out of Group rankings!
          hidden: new Set(["u3"]),
        },
      }),
    );

    // Leaderboard includes Alex (2000) and Sam (1000), but NOT Jordan (hidden)
    expect(snap.people.leaderboard.map((r) => [r.firstName, r.capturedCents, r.isMe])).toEqual([
      ["Alex", 2000, false],
      ["Sam", 1000, true],
    ]);

    // Per-card standings on Sam's Amex Gold show Alex 1st and Sam 2nd
    const goldCard = snap.cards.find((c) => c.id === "gold")!;
    expect(goldCard.standings.map((s) => s.firstName)).toEqual(["Alex", "Sam"]);

    // Alex shares cards + offers; Dell offer is flagged as missingFromMine
    const alex = snap.people.others.find((p) => p.id === "u2")!;
    expect(alex.sharing).toBe(true);
    expect(alex.cards?.[0]?.place).toEqual({ rank: 1, of: 2 });
    expect(alex.offers?.groups[0]).toMatchObject({
      merchant: "Dell Technologies",
      missingFromMine: true,
    });

    // Jordan has sharing: false -> cards is null (private!), but pasted offers still appear
    const jordan = snap.people.others.find((p) => p.id === "u3")!;
    expect(jordan.sharing).toBe(false);
    expect(jordan.cards).toBeNull();
    expect(jordan.offers?.groups[0]).toMatchObject({
      merchant: "lululemon",
      missingFromMine: false,
    });
  });

  it("computes referrals, spend goals, catalog updates, and year-end checklist", () => {
    const snap = buildMobileBootstrap(
      baseInput({
        spendTargets: [
          {
            id: "st1",
            cardId: "gold",
            name: "Annual spend bonus",
            reward: "Free night award",
            targetCents: 1_500_000,
            spentCents: 600_000,
            periodKey: "2026",
            tracked: true,
          },
          {
            id: "st-old",
            cardId: "gold",
            name: "Untracked goal",
            reward: "Lounge guest",
            targetCents: 7_500_000,
            spentCents: 900_000,
            periodKey: "2025",
            tracked: false,
          },
        ],
        referrals: [
          {
            id: "ref-friend",
            userId: "u2",
            firstName: "Alex",
            templateKey: "chase-aeroplan",
            cardName: "Chase Aeroplan",
            url: "https://www.referyourchasecard.com/210/example",
            reward: "15,000 pts",
          },
        ],
      }),
    );

    expect(snap.overview.spendTargets).toHaveLength(1);
    expect(snap.overview.spendTargets[0]?.spentCents).toBe(600_000);
    // Prior-year periodKey resets spentCents to 0
    expect(snap.overview.untrackedSpendTargets[0]?.spentCents).toBe(0);

    // Amex Gold only has 2 benefits in fixture vs full catalog -> catalog updates detected
    expect(snap.overview.catalogUpdateCards[0]?.cardId).toBe("gold");
    expect(snap.overview.catalogUpdateCards[0]?.count).toBeGreaterThan(0);

    // Referrals: Gold is shareable because Sam hasn't shared a link yet; Alex's Aeroplan link attaches to Aeroplan bonus
    expect(snap.referrals.shareableCards.map((c) => c.templateKey)).toEqual(["amex-gold"]);
    expect(snap.referrals.others).toHaveLength(1);
    const aeroplanBonus = snap.bonuses.offers.find((b) => b.offer.id === "chase-aeroplan");
    expect(aeroplanBonus?.friendReferrals.map((r) => r.firstName)).toEqual(["Alex"]);

    // November 15 is inside the Nov-Dec year-end window!
    expect(snap.yearEnd.inWindow).toBe(true);
    expect(snap.yearEnd.daysLeft).toBe(46);
    expect(snap.yearEnd.expiringCount).toBe(2);
    expect(snap.yearEnd.hasAmex).toBe(true);
    expect(snap.yearEnd.cardNotes[0]?.cardId).toBe("gold");
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

    expect(
      parseMobileAction({
        type: "referral.add",
        card: "amex-gold",
        url: "https://americanexpress.com/en-us/credit-cards/referral/prospect",
        reward: "15,000 MR",
      }),
    ).toEqual({
      action: {
        type: "referral.add",
        templateKey: "amex-gold",
        cardName: "Amex Gold",
        url: "https://americanexpress.com/en-us/credit-cards/referral/prospect",
        reward: "15,000 MR",
      },
    });

    expect(
      parseMobileAction({
        type: "spendTarget.setSpent",
        id: "st1",
        spent: "$12,450",
      }),
    ).toEqual({
      action: {
        type: "spendTarget.setSpent",
        id: "st1",
        spentCents: 1_245_000,
      },
    });

    expect(
      parseMobileAction({
        type: "settings.setShareRankings",
        enabled: false,
      }),
    ).toEqual({
      action: {
        type: "settings.setShareRankings",
        enabled: false,
      },
    });

    expect(
      parseMobileAction({
        type: "card.applyCatalogUpdates",
        cardId: "gold",
      }),
    ).toEqual({
      action: {
        type: "card.applyCatalogUpdates",
        cardId: "gold",
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
    expect(
      parseMobileAction({
        type: "referral.add",
        card: "amex-gold",
        url: "http://insecure.example.com",
      }),
    ).toEqual({ error: "Paste the full referral link, starting with https://" });
    expect(parseMobileAction({ type: "unknown.op" })).toEqual({
      error: "Unknown action type: unknown.op.",
    });
  });
});

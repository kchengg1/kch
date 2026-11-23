import { describe, expect, it } from "vitest";
import { msrStatus } from "./msr";
import {
  balanceValueCents,
  checkRedemption,
  defaultCentsPerPoint,
  effectiveCentsPerPointX100,
  normalizeProgram,
  parseBalances,
  resolvePointValuation,
} from "./points";
import { applicationRules, type RuleCard } from "./rules";
import { cardWorth, faceValueCents, myValueCents } from "./worth";

const TODAY = "2026-11-15";

describe("points", () => {
  it("normalises program names people type", () => {
    expect(normalizeProgram("Amex MR")).toBe("American Express Membership Rewards");
    expect(normalizeProgram("American Express Membership Rewards")).toBe(
      "American Express Membership Rewards",
    );
    expect(normalizeProgram("Alaska Mileage Plan")).toBe("Alaska / Hawaiian Atmos Rewards");
    expect(normalizeProgram("Marriott Rewards")).toBe("Marriott Bonvoy");
    expect(normalizeProgram("Some new program")).toBe("Some new program");
    expect(defaultCentsPerPoint("Chase UR")).toBe(1.5);
    expect(defaultCentsPerPoint("Hilton")).toBe(0.35);
    expect(defaultCentsPerPoint("Marriott")).toBe(0.73);
  });

  it("tracks live Frequent Miler estimates unless explicitly overridden", () => {
    // Auto-tracked row ignores stale stored centsPerPointX100 and uses live RRV
    expect(
      effectiveCentsPerPointX100({
        program: "Chase Ultimate Rewards",
        centsPerPointX100: 200,
        customValue: false,
      }),
    ).toBe(150);
    // Custom override preserves user's value
    expect(
      effectiveCentsPerPointX100({
        program: "Chase Ultimate Rewards",
        centsPerPointX100: 210,
        customValue: true,
      }),
    ).toBe(210);

    expect(resolvePointValuation("Chase Ultimate Rewards", "")).toEqual({
      centsPerPointX100: 150,
      customValue: false,
    });
    expect(resolvePointValuation("Chase Ultimate Rewards", "1.5")).toEqual({
      centsPerPointX100: 150,
      customValue: false,
    });
    expect(resolvePointValuation("Chase Ultimate Rewards", "2.1")).toEqual({
      centsPerPointX100: 210,
      customValue: true,
    });
    expect(resolvePointValuation("Chase Ultimate Rewards", "nope")).toBeNull();
  });

  it("reads the balances block from the sheet", () => {
    const text = `Alaska Mileage Plan\t55000
American AAdvantage\t148821
American Express Membership Rewards\t270520
Amtrak Guest Rewards\t
Capital One Venture Rewards\t110000
Delta Skymiles\t16,000
Marriott Rewards\t1000`;
    expect(parseBalances(text)).toEqual([
      { program: "Alaska / Hawaiian Atmos Rewards", balance: 55000 },
      { program: "American AAdvantage", balance: 148821 },
      { program: "American Express Membership Rewards", balance: 270520 },
      { program: "Capital One Venture Rewards", balance: 110000 },
      { program: "Delta SkyMiles", balance: 16000 },
      { program: "Marriott Bonvoy", balance: 1000 },
    ]);
  });

  it("values a balance", () => {
    expect(balanceValueCents(270520, 200)).toBe(541040);
    expect(balanceValueCents(1000, 85)).toBe(850);
  });

  it("says when to pay cash instead of points (the sheet's Marriott example)", () => {
    const check = checkRedemption({
      cashCents: 230000,
      points: 318000,
      feesCents: 0,
      valueCentsPerPoint: 0.85,
    });
    expect(check?.verdict).toBe("cash");
    expect(check?.centsPerPoint).toBeCloseTo(0.723, 3);
    expect(check?.gainCents).toBe(230000 - 270300);
  });

  it("subtracts award taxes before comparing", () => {
    const check = checkRedemption({
      cashCents: 450000,
      points: 120000,
      feesCents: 20000,
      valueCentsPerPoint: 2,
    });
    expect(check?.centsPerPoint).toBeCloseTo(3.583, 3);
    expect(check?.verdict).toBe("points");
    expect(
      checkRedemption({ cashCents: 0, points: 1, feesCents: 0, valueCentsPerPoint: 1 }),
    ).toBeNull();
  });
});

describe("applicationRules", () => {
  const card = (over: Partial<RuleCard>): RuleCard => ({
    name: "x",
    issuer: "Chase",
    business: false,
    openedOn: null,
    ...over,
  });
  const byId = (cards: RuleCard[]) =>
    Object.fromEntries(applicationRules(cards, TODAY).map((r) => [r.id, r]));

  it("counts 5/24 across banks and gives the date it clears", () => {
    const cards = [
      card({ issuer: "American Express", openedOn: "2025-01-10" }),
      card({ issuer: "Citibank", openedOn: "2025-04-01" }),
      card({ issuer: "Chase", openedOn: "2025-06-01" }),
      card({ issuer: "Capital One", openedOn: "2026-01-01" }),
      card({ issuer: "Chase", openedOn: "2026-04-19" }),
      card({ issuer: "Chase", business: true, openedOn: "2026-02-17" }),
    ];
    const r = byId(cards)["chase-524"]!;
    expect(r.status).toBe("wait");
    expect(r.until).toBe("2027-01-10");
    expect(r.detail).toMatch(/^5 personal cards/);
  });

  it("clears 5/24 under five personal cards; business cards do not count", () => {
    const cards = [
      card({ openedOn: "2026-04-19" }),
      card({ business: true, openedOn: "2026-02-17" }),
    ];
    expect(byId(cards)["chase-524"]).toMatchObject({ status: "clear" });
    expect(byId(cards)["chase-524"]!.detail).toMatch(/^1 personal card /);
  });

  it("applies the short-window rules per bank", () => {
    const cards = [
      card({ issuer: "Chase", openedOn: "2026-11-01" }),
      card({ issuer: "American Express", openedOn: "2026-09-01" }),
      card({ issuer: "American Express", openedOn: "2026-10-20" }),
      card({ issuer: "Capital One", openedOn: "2026-08-01" }),
    ];
    const r = byId(cards);
    expect(r["chase-130"]).toMatchObject({ status: "wait", until: "2026-12-01" });
    expect(r["amex-290"]).toMatchObject({ status: "wait", until: "2026-11-30" });
    expect(r["capone-16"]).toMatchObject({ status: "wait", until: "2027-02-01" });
    expect(r["citi-265"]).toMatchObject({ status: "clear" });
    expect(r["bofa-234"]).toMatchObject({ status: "clear" });
  });
});

describe("msrStatus", () => {
  const base = {
    msrCents: 400000,
    msrDeadline: "2026-12-15",
    msrSpentCents: 100000,
    bonusReceivedOn: null,
  };
  it("works out what is left and the daily pace", () => {
    expect(msrStatus(base, TODAY)).toMatchObject({
      leftCents: 300000,
      daysLeft: 30,
      state: "active",
      perDayCents: 9678,
    });
  });
  it("knows met, missed and received", () => {
    expect(msrStatus({ ...base, msrSpentCents: 400000 }, TODAY)?.state).toBe("met");
    expect(msrStatus({ ...base, msrDeadline: "2026-11-01" }, TODAY)?.state).toBe("missed");
    expect(msrStatus({ ...base, bonusReceivedOn: "2026-11-01" }, TODAY)?.state).toBe("received");
    expect(msrStatus({ ...base, msrCents: null }, TODAY)).toBeNull();
  });
});

describe("cardWorth", () => {
  const b = (over: object) => ({
    cadence: "monthly",
    amountCents: 1000,
    tracked: true,
    myValueCents: null,
    endsOn: null,
    ...over,
  });
  it("compares advertised value, your value and the fee", () => {
    const benefits = [
      b({}), // $120/yr face, counted in full
      b({ cadence: "annual", amountCents: 30000, myValueCents: 10000 }), // worth $100 to you
      b({ cadence: "quarterly", amountCents: 9000, tracked: false }), // ignored credit
      b({ cadence: "quadrennial", amountCents: 12000 }), // $30/yr
      b({ cadence: "perk", amountCents: 0, myValueCents: 5000 }), // status worth $50
    ];
    expect(faceValueCents(b({ cadence: "quadrennial", amountCents: 12000 }))).toBe(3000);
    expect(myValueCents(b({ tracked: false }))).toBe(0);
    expect(cardWorth(benefits, 69500, TODAY)).toEqual({
      advertisedCents: 12000 + 30000 + 36000 + 3000,
      worthCents: 12000 + 10000 + 0 + 3000 + 5000,
      netCents: 30000 - 69500,
    });
  });
  it("leaves out benefits that have ended", () => {
    expect(cardWorth([b({ endsOn: "2026-01-01" })], 0, TODAY).advertisedCents).toBe(0);
  });
});

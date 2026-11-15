import { describe, expect, it } from "vitest";
import { offerReturn, rateLabel } from "./offer-value";

const r = (text: string) => {
  const v = offerReturn(text);
  return v && { rate: Math.round(v.rate * 1000) / 1000, maxCents: v.maxCents };
};

describe("offerReturn", () => {
  it("reads spend-and-earn offers", () => {
    expect(r("Spend $50 or more, earn $10 back")).toEqual({ rate: 0.2, maxCents: 1000 });
    expect(r("Spend $5 or more, earn $5 back")).toEqual({ rate: 1, maxCents: 500 });
    expect(r("Spend $1,000 or more, earn $200 back")).toEqual({ rate: 0.2, maxCents: 20000 });
    expect(r("Spend $99 or more, earn $25")).toEqual({ rate: 0.253, maxCents: 2500 });
    expect(r("Spend $250 or more, get $50 back")).toEqual({ rate: 0.2, maxCents: 5000 });
    expect(r("Spend $100 USD or more on qualifying merchandise purchases, earn $20 back")).toEqual({
      rate: 0.2,
      maxCents: 2000,
    });
  });

  it("counts repeats toward the total", () => {
    expect(r("Spend $125 or more, earn $20 back, up to 2 times (total of $40).")).toEqual({
      rate: 0.16,
      maxCents: 4000,
    });
    expect(r("Spend $7.99 or more, earn $7.99 back, up to 2 times (total of $15.98).")).toEqual({
      rate: 1,
      maxCents: 1598,
    });
  });

  it("values points at 2 cents", () => {
    expect(r("Spend $125 or more, earn 3,000 Membership Rewards® points")).toEqual({
      rate: 0.48,
      maxCents: 6000,
    });
    expect(
      r("Earn +6 Membership Rewards® points per eligible dollar spent, up to 5,000 points"),
    ).toEqual({
      rate: 0.12,
      maxCents: 10000,
    });
    expect(
      r("Earn +10 Membership Rewards® points per eligible dollar spent, up to 10,000 pts"),
    ).toEqual({
      rate: 0.2,
      maxCents: 20000,
    });
  });

  it("reads percentage offers and their caps", () => {
    expect(r("Earn 20% back on a single purchase, up to a total of $20")).toEqual({
      rate: 0.2,
      maxCents: 2000,
    });
    expect(r("Earn 2% back on purchases, up to a total of $250")).toEqual({
      rate: 0.02,
      maxCents: 25000,
    });
    expect(
      r("Earn 10% back on qualifying concessions purchases, up to $250 per calendar year"),
    ).toEqual({
      rate: 0.1,
      maxCents: 25000,
    });
    expect(r("10% cash back")).toEqual({ rate: 0.1, maxCents: null });
  });

  it("returns null when the deal text says nothing measurable", () => {
    expect(offerReturn("")).toBeNull();
    expect(offerReturn("Get a free appetizer")).toBeNull();
  });
});

describe("rateLabel", () => {
  it("formats the return", () => {
    expect(rateLabel(0.2)).toBe("20% back");
    expect(rateLabel(1)).toBe("100% back");
    expect(rateLabel(0.005)).toBe("0.5% back");
  });
});

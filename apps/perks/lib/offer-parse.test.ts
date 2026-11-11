import { describe, expect, it } from "vitest";
import { parseOffers } from "./offer-parse";

const TODAY = "2026-11-11";

describe("parseOffers", () => {
  it("reads an Amex Offers list with merchant, deal and expiry", () => {
    const text = `
Recommended Offers
lululemon
Spend $150 or more, get $30 back
Expires 12/15/2026
Add to Card

Hilton Garden Inn
Spend $250 or more, get $50 back, up to 2 times (total of $100)
Expires 1/31/27
Added to Card

Paramount+
Earn +5 Membership Rewards points per eligible dollar spent, up to 5,000 points
Expires 11/30/2026
Add to Card`;
    expect(parseOffers(text, TODAY)).toEqual([
      {
        merchant: "lululemon",
        details: "Spend $150 or more, get $30 back",
        valueCents: 3000,
        expiresOn: "2026-12-15",
        added: false,
      },
      {
        merchant: "Hilton Garden Inn",
        details: "Spend $250 or more, get $50 back, up to 2 times (total of $100)",
        valueCents: 10000,
        expiresOn: "2027-01-31",
        added: true,
      },
      {
        merchant: "Paramount+",
        details: "Earn +5 Membership Rewards points per eligible dollar spent, up to 5,000 points",
        valueCents: null,
        expiresOn: "2026-11-30",
        added: false,
      },
    ]);
  });

  it("reads Chase Offers with percentages and days left", () => {
    const text = `Starbucks
10% cash back
14d left
Add offer
Shake Shack
5% back
3 days left
Add offer`;
    expect(parseOffers(text, TODAY)).toEqual([
      {
        merchant: "Starbucks",
        details: "10% cash back",
        valueCents: null,
        expiresOn: "2026-11-25",
        added: false,
      },
      {
        merchant: "Shake Shack",
        details: "5% back",
        valueCents: null,
        expiresOn: "2026-11-14",
        added: false,
      },
    ]);
  });

  it("handles the deal listed before the merchant", () => {
    const text = `Spend $80 or more, get $15 back
Wine.com
Expires 12/01/2026`;
    expect(parseOffers(text, TODAY)[0]).toMatchObject({
      merchant: "Wine.com",
      valueCents: 1500,
      expiresOn: "2026-12-01",
    });
  });

  it("rolls a date without a year into next year once it has passed", () => {
    const [jan, dec] = parseOffers(
      `Delta\nSpend $300, get $60 back\nExpires 1/15\nMarriott\nSpend $200, get $40 back\nExpires Dec 20`,
      TODAY,
    );
    expect(jan?.expiresOn).toBe("2027-01-15");
    expect(dec?.expiresOn).toBe("2026-12-20");
  });

  it("separates offers that list no expiry", () => {
    const offers = parseOffers(
      `Nike\nSpend $100 or more, get $20 back\nAdd to Card\nAdidas\nSpend $75 or more, get $15 back\nAdd to Card`,
      TODAY,
    );
    expect(offers.map((o) => [o.merchant, o.valueCents, o.expiresOn])).toEqual([
      ["Nike", 2000, null],
      ["Adidas", 1500, null],
    ]);
  });

  it("drops duplicates and text that is not an offer", () => {
    const text = `Nike\nSpend $100 or more, get $20 back\nExpires 12/31/2026\nNike\nSpend $100 or more, get $20 back\nExpires 12/31/2026\nView Details`;
    expect(parseOffers(text, TODAY)).toHaveLength(1);
    expect(parseOffers("Welcome back\nYour account summary", TODAY)).toEqual([]);
  });
});

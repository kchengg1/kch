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

  it("reads a real Amex Offers page and ignores its header, ads and footer", () => {
    // Shape of americanexpress.com's offers page as copied with Cmd+A (trimmed).
    const page = `Skip to main
Menu
American Express
Search Button
Customer Service
Log Out
Added to Card
View All
You haven't added any offers to your Card
Add offers and earn statement credit or points on qualifying purchases
Saved from Offers
$344.57
View Activity
Recommended Offers
Search
Filter
Sort ByRecommended


Walmart.com
Walmart.com
Spend $50 or more, earn $10 back
Expires 11/22/26


Terms apply

View Details

american_express_logo
Share the Gold Card® Benefits
Add an Additional Gold Card® Member and earn 10,000 Membership Rewards® points after they spend $2,000 in purchases in the first six months. Terms apply.
Add a Member
Sometimes Plans Change
Purchase Trip Cancel Guard® and get up to 75% reimbursement if you cancel your eligible flight. Terms apply.
Learn More
Nordstrom & Nordstrom Rack - Clothes, Shoes, Jewelry, and more
Nordstrom & Nordstrom Rack - Clothes, Shoes, Jewelry, and more
Spend $100 or more, earn $20 back
Expires 12/31/26

Terms apply
View Details

NEW

Pimsleur - Learn Language Online
Pimsleur - Learn Language Online
Spend $20 or more, earn $20 back, up to 2 times (total of $40).
Expires 1/31/27

Terms apply
View Details

adidas.com
adidas.com
Earn +6 Membership Rewards® points per eligible dollar spent, up to 5,000 points
Expires 12/31/26
Terms apply
View Details
Last Login: 15 Nov 2026 @ 10:01
About
Membership Rewards
© 2026 American Express. All rights reserved
Give Feedback`;
    expect(parseOffers(page, TODAY)).toEqual([
      {
        merchant: "Walmart.com",
        details: "Spend $50 or more, earn $10 back",
        valueCents: 1000,
        expiresOn: "2026-11-22",
        added: false,
      },
      {
        merchant: "Nordstrom & Nordstrom Rack - Clothes, Shoes, Jewelry, and more",
        details: "Spend $100 or more, earn $20 back",
        valueCents: 2000,
        expiresOn: "2026-12-31",
        added: false,
      },
      {
        merchant: "Pimsleur - Learn Language Online",
        details: "Spend $20 or more, earn $20 back, up to 2 times (total of $40).",
        valueCents: 4000,
        expiresOn: "2027-01-31",
        added: false,
      },
      {
        merchant: "adidas.com",
        details: "Earn +6 Membership Rewards® points per eligible dollar spent, up to 5,000 points",
        valueCents: null,
        expiresOn: "2026-12-31",
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

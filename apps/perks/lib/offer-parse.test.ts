import { describe, expect, it } from "vitest";
import { detectCardFromOffersText, parseOffers } from "./offer-parse";

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

  it("keeps offers already added to the card, which show no deal text", () => {
    // Amex lists added offers in a box at the top with only a name and expiry.
    // This copy came through with Markdown links and bullets.
    const page = `[Skip to main](https://example.com/offers#mainContent)
Menu
* [Customer Service](https://example.com/help)
Amex EveryDay® Card
* 
* 
Added to Card (2)
[View All](https://example.com/offers/enrolled)
MTA - Tap to Pay
Expires 12/31/26
lululemon
Expires 1/31/27
Saved from Offers
$37.00
[View Activity](https://example.com/offers/redeemed)
Recommended Offers
Search
Walmart.com
Spend $50 or more, earn $10 back
Expires 11/22/26
Terms apply
View Details
NEW
lululemon
Spend $150 or more, earn $30 back
Expires 1/31/27
Terms apply
View Details
Last Login: 15 Nov 2026 @ 10:01
* [About American Express](https://example.com/company)`;
    expect(parseOffers(page, TODAY)).toEqual([
      {
        merchant: "MTA - Tap to Pay",
        details: "",
        valueCents: null,
        expiresOn: "2026-12-31",
        added: true,
      },
      {
        merchant: "lululemon",
        details: "Spend $150 or more, earn $30 back",
        valueCents: 3000,
        expiresOn: "2027-01-31",
        added: true,
      },
      {
        merchant: "Walmart.com",
        details: "Spend $50 or more, earn $10 back",
        valueCents: 1000,
        expiresOn: "2026-11-22",
        added: false,
      },
    ]);
  });

  it("does not treat an empty Added to Card box as an offer", () => {
    const page = `Added to Card
View All
You haven't added any offers to your Card
Add offers and earn statement credit or points on qualifying purchases
Saved from Offers
Recommended Offers
Walmart.com
Spend $50 or more, earn $10 back
Expires 11/22/26`;
    expect(parseOffers(page, TODAY).map((o) => [o.merchant, o.added])).toEqual([
      ["Walmart.com", false],
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

  it("reads a real Chase Offers page where each tile copies as one line", () => {
    // Shape of chase.com's offers page as copied with Cmd+A (trimmed). Each
    // tile is "New" + merchant + deal glued together, and the filter menu
    // includes an "Added to card" option.
    const page = `[Skip to main content](https://secure.chase.com/web/auth/dashboard)
Open an account
Sign out
[Skip primary navigation](https://secure.chase.com/web/auth/dashboard)
Accounts
Pay & transfer
Benefits & travel
Back
Chase Offers
All
Shopping
Travel
Food & drink
All deals
Offer status
Added to card
Not added
Ways to shop
Online
In-store
Brand
A-F
0-9
136 results
Sort by
Recommended
[NewHyatt Essentials10% cash back](https://secure.chase.com/#)
[NewSunocoUp to 5% back](https://secure.chase.com/#)
[NewYouTube Channel Memberships100% cash backExpiring soon](https://secure.chase.com/#)
[NewLululemon10% back](https://secure.chase.com/#)
[NewParamount+$4 cash back](https://secure.chase.com/#)
[NewMyEyeDr.15% cash back](https://secure.chase.com/#)
[NewFubo: Live TV + Sports40% cash back](https://secure.chase.com/#)
[NeweBay5% cash back](https://secure.chase.com/#)
[NewiRobot10% cash back](https://secure.chase.com/#)
[NewNew Balance10% cash back](https://secure.chase.com/#)
[NewTonal$250 cash back](https://secure.chase.com/#)`;
    const offers = parseOffers(page, TODAY);
    expect(offers.map((o) => [o.merchant, o.details, o.valueCents, o.added])).toEqual([
      ["Hyatt Essentials", "10% cash back", null, false],
      ["Sunoco", "Up to 5% back", null, false],
      ["YouTube Channel Memberships", "100% cash back", null, false],
      ["Lululemon", "10% back", null, false],
      ["Paramount+", "$4 cash back", 400, false],
      ["MyEyeDr.", "15% cash back", null, false],
      ["Fubo: Live TV + Sports", "40% cash back", null, false],
      ["eBay", "5% cash back", null, false],
      ["iRobot", "10% cash back", null, false],
      ["New Balance", "10% cash back", null, false],
      ["Tonal", "$250 cash back", 25000, false],
    ]);
    expect(offers.some((o) => /skip to main/i.test(o.merchant))).toBe(false);
  });

  it("keeps deal sentences whole and splits a merchant ending in digits correctly", () => {
    expect(parseOffers("Studio 5410% cash back", TODAY)[0]).toMatchObject({
      merchant: "Studio 54",
      details: "10% cash back",
    });
    expect(
      parseOffers("Nike\nSpend $100 or more, get $20 back\nAdd to Card", TODAY)[0],
    ).toMatchObject({ merchant: "Nike", details: "Spend $100 or more, get $20 back" });
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

describe("detectCardFromOffersText", () => {
  const cards = [
    { id: "bbp", name: "Amex Blue Business Plus" },
    { id: "gold", name: "Amex Gold" },
    { id: "biz-gold", name: "Amex Business Gold" },
    { id: "csr", name: "Chase Sapphire Reserve" },
  ];

  it("matches Amex Blue Business Plus from a copied Amex offers page", () => {
    const page = `American Express
The Blue Business® Plus Credit Card (-21004)
Amex Offers
lululemon
Spend $150 or more, get $30 back`;
    expect(detectCardFromOffersText(page, cards)).toBe("bbp");
  });

  it("prefers the more specific Business Gold over personal Gold", () => {
    const page = `American Express® Business Gold Card
Amex Offers
Dell
Spend $200 or more, get $40 back`;
    expect(detectCardFromOffersText(page, cards)).toBe("biz-gold");
  });

  it("matches Chase Sapphire Reserve from a Chase header", () => {
    const page = `Chase Offers
Sapphire Reserve (...4321)
Lululemon 10% back`;
    expect(detectCardFromOffersText(page, cards)).toBe("csr");
  });

  it("does not falsely match single-word card names in merchant lines", () => {
    const page = `Amex Offers
Gold's Gym
Spend $50 or more, get $10 back`;
    expect(detectCardFromOffersText(page, cards)).toBeNull();
  });

  it("returns null when two cards tie", () => {
    const dupes = [
      { id: "p1", name: "Amex Platinum" },
      { id: "p2", name: "Amex Platinum" },
    ];
    expect(detectCardFromOffersText("The Platinum Card®\nAmex Offers", dupes)).toBeNull();
  });
});

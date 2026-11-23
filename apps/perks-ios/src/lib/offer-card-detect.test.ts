import { describe, expect, it } from "vitest";
import { detectCardFromOffersText } from "./offer-card-detect";

describe("detectCardFromOffersText (iOS)", () => {
  const cards = [
    { id: "bbp", name: "Amex Blue Business Plus" },
    { id: "gold", name: "Amex Gold" },
    { id: "biz-gold", name: "Amex Business Gold" },
    { id: "csr", name: "Chase Sapphire Reserve" },
  ];

  it("matches Amex Blue Business Plus and prefers Business Gold over Gold", () => {
    expect(
      detectCardFromOffersText("The Blue Business® Plus Credit Card (-21004)\nAmex Offers", cards),
    ).toBe("bbp");
    expect(
      detectCardFromOffersText("American Express® Business Gold Card\nAmex Offers", cards),
    ).toBe("biz-gold");
  });

  it("avoids false positives on single-word merchant names", () => {
    expect(
      detectCardFromOffersText("Amex Offers\nGold's Gym\nSpend $50, get $10 back", cards),
    ).toBeNull();
  });
});

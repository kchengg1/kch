import { describe, expect, it } from "vitest";
import { groupOffers, type OfferLike } from "./offer-groups";

const offer = (over: Partial<OfferLike>): OfferLike => ({
  id: Math.random().toString(36),
  cardId: "gold",
  merchant: "Walmart.com",
  details: "Spend $50 or more, earn $10 back",
  valueCents: 1000,
  expiresOn: "2026-11-22",
  status: "available",
  ...over,
});

describe("groupOffers", () => {
  it("shows an offer listed on several cards once", () => {
    const groups = groupOffers([
      offer({ cardId: "gold" }),
      offer({ cardId: "everyday", merchant: "walmart.com " }),
      offer({
        cardId: "biz",
        merchant: "Marriott Bonvoy®",
        details: "Spend $375, earn $150 back",
        expiresOn: "2026-11-23",
      }),
      offer({
        cardId: "gold",
        merchant: "Marriott Bonvoy",
        details: "Spend $375, earn $150 back",
        expiresOn: "2026-11-23",
      }),
    ]);
    expect(groups.map((g) => [g.merchant, g.items.map((i) => i.cardId)])).toEqual([
      ["Walmart.com", ["gold", "everyday"]],
      ["Marriott Bonvoy®", ["biz", "gold"]],
    ]);
  });

  it("keeps different deals or expiry dates at the same merchant apart", () => {
    const groups = groupOffers([
      offer({}),
      offer({ details: "Spend $75 or more, earn $15 back" }),
      offer({ expiresOn: "2026-12-31" }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("fills in deal text from a card that shows it", () => {
    const [g] = groupOffers([
      offer({ details: "", valueCents: null, merchant: "lululemon", status: "added" }),
      offer({ details: "", merchant: "lululemon", cardId: "everyday" }),
    ]);
    expect(g?.items).toHaveLength(2);
  });

  it("sorts by expiry, undated last", () => {
    const groups = groupOffers([
      offer({ merchant: "B", expiresOn: null }),
      offer({ merchant: "A", expiresOn: "2026-12-01" }),
    ]);
    expect(groups.map((g) => g.merchant)).toEqual(["A", "B"]);
  });
});

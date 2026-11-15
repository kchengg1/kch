import { describe, expect, it } from "vitest";
import type { OfferLike } from "./offer-groups";
import { firstName, liveMerchantKeys, offersByPerson } from "./shared-offers";

type O = OfferLike & { userId: string };
const offer = (over: Partial<O>): O => ({
  id: Math.random().toString(36),
  userId: "ann",
  cardId: "gold",
  merchant: "Walmart.com",
  details: "Spend $50 or more, earn $10 back",
  valueCents: 1000,
  expiresOn: "2026-11-22",
  status: "available",
  ...over,
});

const people = [
  { id: "me", name: "Kevin Cheng" },
  { id: "ann", name: "Ann Lee" },
  { id: "bob", name: "Bob" },
  { id: "cat", name: "Cat Wu" },
];
const today = "2026-11-15";

describe("offersByPerson", () => {
  it("leaves out the viewer and people with no live offers", () => {
    const result = offersByPerson(
      people,
      [
        offer({ userId: "me" }),
        offer({ userId: "bob" }),
        offer({ userId: "ann" }),
        offer({ userId: "cat", status: "used" }),
      ],
      "me",
      today,
    );
    expect(result.map((p) => p.firstName)).toEqual(["Ann", "Bob"]);
  });

  it("drops used, skipped and expired offers but keeps added ones", () => {
    const [ann] = offersByPerson(
      people,
      [
        offer({ merchant: "Old", expiresOn: "2026-11-14" }),
        offer({ merchant: "Skipped", status: "dismissed" }),
        offer({ merchant: "Added", status: "added" }),
        offer({ merchant: "No date", expiresOn: null }),
      ],
      "me",
      today,
    );
    expect(ann!.groups.map((g) => g.merchant).sort()).toEqual(["Added", "No date"]);
  });

  it("groups the same deal across cards and sorts best return first", () => {
    const [ann] = offersByPerson(
      people,
      [
        offer({ merchant: "Weak", details: "Spend $500 or more, earn $25 back" }),
        offer({ cardId: "gold" }),
        offer({ cardId: "plat" }),
      ],
      "me",
      today,
    );
    expect(ann!.groups.map((g) => g.merchant)).toEqual(["Walmart.com", "Weak"]);
    expect(ann!.groups[0]!.items.map((o) => o.cardId)).toEqual(["gold", "plat"]);
    expect(ann!.groups[0]!.rate).toBeCloseTo(0.2);
  });
});

describe("helpers", () => {
  it("uses first names", () => {
    expect(firstName("  Ann  Lee ")).toBe("Ann");
    expect(firstName("")).toBe("Someone");
  });

  it("collects the viewer's live merchants", () => {
    const keys = liveMerchantKeys(
      [offer({ merchant: "Walmart.com®" }), offer({ merchant: "Hulu", status: "used" })],
      today,
    );
    expect([...keys]).toEqual(["walmart.com"]);
  });
});

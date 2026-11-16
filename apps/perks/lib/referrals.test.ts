import { describe, expect, it } from "vitest";
import { friendsLinksFor, shareableCards } from "./referrals";

const card = (id: string, templateKey: string | null, closed = false) => ({
  id,
  name: id,
  closed,
  templateKey,
  issuer: "Chase",
});

describe("referrals", () => {
  const cards = [
    card("gold", "amex-gold"),
    card("plat1", "amex-platinum"),
    card("plat2", "amex-platinum"),
    card("csr", "chase-sapphire-reserve"),
    card("old", "chase-freedom", true),
    card("custom", null),
  ];
  const referrals = [
    { userId: "me", templateKey: "amex-gold", cardName: "Amex Gold" },
    { userId: "andy", templateKey: "chase-sapphire-reserve", cardName: "CSR" },
  ];

  it("lists open cards without a link, once per card type", () => {
    expect(shareableCards(cards, referrals, "me").map((c) => c.id)).toEqual(["plat1", "csr"]);
  });

  it("finds friends' links for a card", () => {
    expect(friendsLinksFor(referrals, "chase-sapphire-reserve", "me")).toHaveLength(1);
    expect(friendsLinksFor(referrals, "chase-sapphire-reserve", "andy")).toHaveLength(0);
    expect(friendsLinksFor(referrals, null, "me")).toHaveLength(0);
  });
});

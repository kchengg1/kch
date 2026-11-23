import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { EARN, classify, rankCards } from "./earn";
import { defaultCentsPerPoint } from "./points";
import { SPEND_TARGETS, spentThisYear } from "./spend-targets";

const card = (templateKey: string, over: object = {}) => ({
  id: templateKey,
  name: CATALOG.find((t) => t.key === templateKey)?.name ?? templateKey,
  templateKey,
  issuer: CATALOG.find((t) => t.key === templateKey)?.issuer ?? "",
  closed: false,
  ...over,
});
const names = (picks: { cardId: string }[]) => picks.map((p) => p.cardId);

describe("earn data", () => {
  it("covers every card in the catalog", () => {
    for (const t of CATALOG) expect(EARN[t.key], t.key).toBeDefined();
    for (const key of Object.keys(SPEND_TARGETS))
      expect(CATALOG.some((t) => t.key === key)).toBe(true);
  });
});

describe("classify", () => {
  it("maps merchants and category words", () => {
    expect(classify("Starbucks")).toEqual({ category: "dining" });
    expect(classify("Whole Foods")).toEqual({ category: "groceries" });
    expect(classify("Park Hyatt Tokyo")).toEqual({ category: "hotels", chain: "hyatt" });
    expect(classify("Costco")).toEqual({ category: "wholesale", chain: "costco" });
    expect(classify("Lyft")).toEqual({ category: "transit", chain: "lyft" });
    expect(classify("gas")).toEqual({ category: "gas" });
    expect(classify("Dining")).toEqual({ category: "dining" });
    expect(classify("Best Buy")).toEqual({ category: "other" });
  });
});

describe("rankCards", () => {
  const wallet = [
    card("amex-gold"),
    card("chase-sapphire-reserve"),
    card("capital-one-venture-x"),
    card("chase-hyatt"),
    card("amex-business-platinum"),
    card("discover-it"),
    card("amex-platinum", { closed: true }),
  ];
  const value = (p: string) => defaultCentsPerPoint(p);

  it("puts Amex Gold first for dining and groceries", () => {
    const dining = rankCards(wallet, { category: "dining" }, value);
    expect(dining[0]).toMatchObject({ cardId: "amex-gold", x: 4, returnPct: 6 });
    expect(names(dining)).not.toContain("amex-platinum");
  });

  it("prefers the hotel's own card at that chain", () => {
    const hyatt = rankCards(wallet, classify("Hyatt Regency"), value);
    expect(hyatt[0]).toMatchObject({ cardId: "chase-sapphire-reserve", x: 4 });
    expect(hyatt.find((p) => p.cardId === "chase-hyatt")).toMatchObject({ x: 4, returnPct: 6 });
    // Not a Hyatt, so the Hyatt card's 4x does not apply.
    expect(
      rankCards(wallet, classify("Marriott"), value).find((p) => p.cardId === "chase-hyatt")?.x,
    ).toBe(1);
  });

  it("uses Venture X's 2x for everyday spending and keeps portal rates as tips", () => {
    const other = rankCards(wallet, { category: "other" }, value);
    expect(other[0]).toMatchObject({ cardId: "capital-one-venture-x", x: 2, returnPct: 2.9 });
    expect(other[0]?.portal).toMatch(/Capital One Travel/);
    expect(other.find((p) => p.cardId === "discover-it")?.rotating).toBe(true);
  });

  it("values Freedom points as cash unless a Sapphire is open", () => {
    const alone = rankCards([card("chase-freedom-unlimited")], { category: "dining" }, value);
    expect(alone[0]).toMatchObject({ x: 3, currency: "Cash back", returnPct: 3 });
    const pooled = rankCards(
      [card("chase-freedom-unlimited"), card("chase-sapphire-preferred")],
      { category: "drugstores" },
      value,
    );
    expect(pooled[0]).toMatchObject({ cardId: "chase-freedom-unlimited", returnPct: 4.5 });
  });

  it("uses the owner's own point values", () => {
    const cheap = rankCards(wallet, { category: "dining" }, (p) =>
      p.includes("Membership") ? 0.5 : 2,
    );
    expect(cheap[0]?.cardId).toBe("chase-sapphire-reserve");
  });
});

describe("spentThisYear", () => {
  it("only counts this year's total", () => {
    expect(spentThisYear({ spentCents: 500000, periodKey: "2026" }, "2026-11-15")).toBe(500000);
    expect(spentThisYear({ spentCents: 500000, periodKey: "2025" }, "2026-11-15")).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { cardStyle } from "./card-style";

describe("cardStyle", () => {
  it("has a finish for every card in the catalog", () => {
    for (const t of CATALOG) expect(cardStyle(t.key).label).toMatch(/finish/);
  });

  it("falls back to the issuer, then to grey", () => {
    expect(cardStyle(null, "Chase")).toMatchObject({ label: "Blue" });
    expect(cardStyle(null, "U.S. Bank").label).toBe("Indigo");
    expect(cardStyle("unknown", "Bank of America").label).toBe("Red");
    expect(cardStyle(null, "")).toMatchObject({ label: "Grey" });
  });
});

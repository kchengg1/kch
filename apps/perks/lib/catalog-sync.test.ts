import { describe, expect, it } from "vitest";
import { catalogUpdates, templateRow } from "./catalog-sync";
import { getTemplate } from "./catalog";

const rowsFor = (key: string) =>
  getTemplate(key)!.benefits.map((t, i) => ({ id: `b${i}`, ...templateRow(t) }));

describe("catalogUpdates", () => {
  it("finds nothing for a card set up from the current catalog", () => {
    expect(catalogUpdates("chase-ihg-premier", rowsFor("chase-ihg-premier"))).toEqual({
      added: [],
      changed: [],
      removed: [],
    });
  });

  it("offers to remove credits the card no longer has", () => {
    const rows = [
      ...rowsFor("amex-platinum"),
      {
        id: "saks",
        ...templateRow({ name: "Saks Fifth Avenue credit", cadence: "semiannual", amount: 50 }),
      },
    ];
    const { added, changed, removed } = catalogUpdates("amex-platinum", rows);
    expect([added, changed, removed.map((b) => b.id)]).toEqual([[], [], ["saks"]]);
  });

  it("finds new and changed credits on an older card", () => {
    const old = [
      {
        id: "x",
        name: "United TravelBank credit",
        cadence: "annual",
        amountCents: 5000,
        endsOn: null,
      },
    ];
    const { added, changed } = catalogUpdates("chase-ihg-premier", old);
    expect(changed.map((c) => [c.benefit.id, c.template.cadence, c.template.amount])).toEqual([
      ["x", "semiannual", 25],
    ]);
    expect(added.map((t) => t.name)).toContain("IHG food and beverage credit");
    expect(added.map((t) => t.name)).not.toContain("United TravelBank credit");
  });

  it("matches names regardless of case and ignores edited notes", () => {
    const rows = rowsFor("amex-gold").map((r) => ({
      ...r,
      name: r.name.toUpperCase(),
      notes: "mine",
    }));
    expect(catalogUpdates("amex-gold", rows).changed).toEqual([]);
  });

  it("does nothing for cards without a template", () => {
    expect(catalogUpdates(null, [])).toEqual({ added: [], changed: [], removed: [] });
  });
});

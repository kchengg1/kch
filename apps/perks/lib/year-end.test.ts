import { describe, expect, it } from "vitest";
import { buildStatuses, type BenefitRow, type CardRow } from "./summary";
import {
  anniversaryUnused,
  APPLY_LATER,
  APPLY_NOW,
  applyTips,
  endsForGood,
  expiringAtYearEnd,
  inYearEndWindow,
  notesFor,
  YEAR_END_NOTES,
} from "./year-end";
import { getTemplate } from "./catalog";

const card: CardRow = {
  id: "c1",
  name: "Amex Platinum",
  annualFeeCents: 89500,
  openedOn: "2024-03-10",
  closed: false,
  templateKey: "amex-platinum",
};
let n = 0;
const benefit = (b: Partial<BenefitRow>): BenefitRow => ({
  id: `b${++n}`,
  cardId: "c1",
  name: "Credit",
  cadence: "annual",
  amountCents: 10000,
  notes: "",
  enrollRequired: false,
  enrolled: false,
  tracked: true,
  endsOn: null,
  sortOrder: 0,
  ...b,
});

describe("year-end checklist", () => {
  const today = "2026-11-16";
  const airline = benefit({ name: "Airline", cadence: "annual", amountCents: 20000 });
  const hotel = benefit({ name: "Hotel", cadence: "semiannual", amountCents: 30000 });
  const resy = benefit({ name: "Resy", cadence: "quarterly", amountCents: 10000 });
  const travel = benefit({ name: "Travel", cadence: "anniversary", amountCents: 30000 });
  const oneOff = benefit({ name: "2026 hotel", amountCents: 25000, endsOn: "2026-12-31" });
  const ignored = benefit({ name: "Peloton", tracked: false });
  const used = benefit({ name: "CLEAR", amountCents: 20900 });
  const statuses = buildStatuses(
    [card],
    [airline, hotel, resy, travel, oneOff, ignored, used],
    [{ benefitId: used.id, periodKey: "2026", usedCents: 20900 }],
    today,
  );

  it("lists unused calendar credits that reset by December 31", () => {
    const names = expiringAtYearEnd(statuses, today).map((s) => s.benefit.name);
    expect(names.sort()).toEqual(["2026 hotel", "Airline", "Hotel", "Resy"]);
  });

  it("keeps cardmember-year credits out of the rush", () => {
    expect(anniversaryUnused(statuses).map((s) => s.benefit.name)).toEqual(["Travel"]);
  });

  it("flags credits that end for good", () => {
    const gone = expiringAtYearEnd(statuses, today).filter(endsForGood);
    expect(gone.map((s) => s.benefit.name)).toEqual(["2026 hotel"]);
  });

  it("shows the overview banner in November and December only", () => {
    expect(inYearEndWindow("2026-10-31")).toBe(false);
    expect(inYearEndWindow("2026-11-01")).toBe(true);
    expect(inYearEndWindow("2026-12-31")).toBe(true);
    expect(inYearEndWindow("2027-01-01")).toBe(false);
  });

  it("drops dated notes once they pass", () => {
    const csr = (d: string) => notesFor("chase-sapphire-reserve", d).map((x) => x.text);
    expect(csr("2026-12-31").some((t) => t.includes("$250 hotel"))).toBe(true);
    expect(csr("2027-01-01").some((t) => t.includes("$250 hotel"))).toBe(false);
  });

  it("only keys notes to catalog cards", () => {
    for (const key of Object.keys(YEAR_END_NOTES)) expect(getTemplate(key), key).toBeDefined();
  });

  it("suggests double-dip cards the user doesn't already hold", () => {
    const held = [
      { name: "Amex Platinum", templateKey: "amex-platinum" },
      { name: "Chase Sapphire Reserve", templateKey: "chase-sapphire-reserve" },
    ];
    const now = applyTips(APPLY_NOW, held, today).map((t) => t.name);
    expect(now).not.toContain("Amex Platinum");
    expect(now).toContain("Amex Business Platinum");
    expect(now).toContain("Southwest personal cards");
    expect(applyTips(APPLY_NOW, held, "2026-12-03").map((t) => t.name)).not.toContain(
      "Southwest personal cards",
    );
    expect(applyTips(APPLY_LATER, held, today)).toEqual([]);
    expect(applyTips(APPLY_LATER, [], today).map((t) => t.name)).toEqual([
      "Chase Sapphire Reserve",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  actionable,
  buildStatuses,
  summarizeCards,
  type BenefitRow,
  type CardRow,
} from "./summary";

const TODAY = "2026-11-11";
const csr: CardRow = {
  id: "csr",
  name: "CSR",
  annualFeeCents: 79500,
  openedOn: "2025-03-01",
  closed: false,
};
const benefit = (over: Partial<BenefitRow>): BenefitRow => ({
  id: "b",
  cardId: "csr",
  name: "Benefit",
  cadence: "monthly",
  amountCents: 1000,
  notes: "",
  enrollRequired: false,
  enrolled: false,
  tracked: true,
  endsOn: null,
  sortOrder: 0,
  ...over,
});

describe("buildStatuses", () => {
  it("reports what is left in the current period", () => {
    const [lyft] = buildStatuses(
      [csr],
      [benefit({ id: "lyft" })],
      [
        { benefitId: "lyft", periodKey: "2026-11", usedCents: 400 },
        { benefitId: "lyft", periodKey: "2026-10", usedCents: 1000 },
      ],
      TODAY,
    );
    expect(lyft).toMatchObject({
      usedCents: 400,
      remainingCents: 600,
      done: false,
      daysLeft: 19,
      deadline: "2026-11-30",
    });
  });

  it("treats a ticked reminder with no dollar amount as done", () => {
    const activate = benefit({ id: "act", cadence: "quarterly", amountCents: 0 });
    expect(buildStatuses([csr], [activate], [], TODAY)[0]?.done).toBe(false);
    expect(
      buildStatuses(
        [csr],
        [activate],
        [{ benefitId: "act", periodKey: "2026-Q4", usedCents: 0 }],
        TODAY,
      )[0]?.done,
    ).toBe(true);
  });

  it("uses a limited-time benefit's end date as the deadline, then drops it", () => {
    const promo = benefit({ id: "p", cadence: "annual", endsOn: "2026-11-20" });
    expect(buildStatuses([csr], [promo], [], TODAY)[0]).toMatchObject({
      daysLeft: 9,
      deadline: "2026-11-20",
    });
    expect(buildStatuses([csr], [promo], [], "2026-11-21")).toEqual([]);
  });

  it("ignores closed cards", () => {
    expect(buildStatuses([{ ...csr, closed: true }], [benefit({})], [], TODAY)).toEqual([]);
  });
});

describe("actionable", () => {
  it("lists unused, tracked credits by deadline and skips perks", () => {
    const statuses = buildStatuses(
      [csr],
      [
        benefit({ id: "travel", name: "Travel", cadence: "anniversary", amountCents: 30000 }),
        benefit({ id: "lyft", name: "Lyft" }),
        benefit({ id: "peloton", name: "Peloton", tracked: false }),
        benefit({ id: "door", name: "DoorDash", amountCents: 1500 }),
        benefit({ id: "lounge", name: "Lounge", cadence: "perk", amountCents: 0 }),
        benefit({ id: "dining", name: "Dining", cadence: "semiannual", amountCents: 15000 }),
      ],
      [{ benefitId: "dining", periodKey: "2026-H2", usedCents: 15000 }],
      TODAY,
    );
    expect(actionable(statuses).map((s) => s.benefit.name)).toEqual(["DoorDash", "Lyft", "Travel"]);
  });
});

describe("summarizeCards", () => {
  it("totals a year of tracked credits against what was logged", () => {
    const [summary] = summarizeCards(
      [csr],
      [
        benefit({ id: "lyft" }),
        benefit({ id: "dining", cadence: "semiannual", amountCents: 15000 }),
        benefit({ id: "travel", cadence: "anniversary", amountCents: 30000 }),
        benefit({ id: "skip", amountCents: 1000, tracked: false }),
      ],
      [
        { benefitId: "lyft", periodKey: "2026-10", usedCents: 1000 },
        { benefitId: "lyft", periodKey: "2026-11", usedCents: 2500 },
        { benefitId: "lyft", periodKey: "2025-12", usedCents: 1000 },
        { benefitId: "travel", periodKey: "A2026", usedCents: 30000 },
      ],
      TODAY,
    );
    expect(summary).toMatchObject({
      availableCents: 12000 + 30000 + 30000,
      // Over-logging is capped at the credit; last year's usage is excluded.
      capturedCents: 1000 + 1000 + 30000,
      nextFeeOn: "2027-03-01",
    });
  });
});

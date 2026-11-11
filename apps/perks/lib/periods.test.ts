import { describe, expect, it } from "vitest";
import {
  addDays,
  currentPeriod,
  daysBetween,
  nextAnniversary,
  periodsThisYear,
  todayIn,
} from "./periods";

describe("currentPeriod", () => {
  it("covers the calendar cadences", () => {
    expect(currentPeriod("monthly", "2026-11-11")).toMatchObject({
      key: "2026-11",
      start: "2026-11-01",
      end: "2026-11-30",
    });
    expect(currentPeriod("monthly", "2028-02-10")?.end).toBe("2028-02-29");
    expect(currentPeriod("quarterly", "2026-11-11")).toMatchObject({
      key: "2026-Q4",
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(currentPeriod("semiannual", "2026-06-30")).toMatchObject({
      key: "2026-H1",
      end: "2026-06-30",
    });
    expect(currentPeriod("semiannual", "2026-07-01")?.key).toBe("2026-H2");
    expect(currentPeriod("annual", "2026-11-11")).toMatchObject({ key: "2026", end: "2026-12-31" });
    expect(currentPeriod("perk", "2026-11-11")).toBeNull();
  });

  it("runs the cardmember year from the approval date", () => {
    // Opened Mar 1 2025: in Nov 2026 the year started Mar 1 2026.
    expect(currentPeriod("anniversary", "2026-11-11", "2025-03-01")).toMatchObject({
      key: "A2026",
      start: "2026-03-01",
      end: "2027-02-28",
    });
    // Before this year's anniversary the year started last year.
    expect(currentPeriod("anniversary", "2026-11-11", "2021-12-27")).toMatchObject({
      key: "A2025",
      start: "2025-12-27",
      end: "2026-12-26",
    });
    // On the anniversary itself a new year begins.
    expect(currentPeriod("anniversary", "2026-12-27", "2021-12-27")?.key).toBe("A2026");
  });

  it("clamps a Feb 29 approval date in non-leap years", () => {
    expect(currentPeriod("anniversary", "2026-03-01", "2024-02-29")).toMatchObject({
      start: "2026-02-28",
      end: "2027-02-27",
    });
  });

  it("falls back to the calendar year without an approval date", () => {
    expect(currentPeriod("anniversary", "2026-11-11", null)?.key).toBe("2026");
  });

  it("groups four-year credits from the year the card opened", () => {
    expect(currentPeriod("quadrennial", "2026-11-11", "2021-12-27")).toMatchObject({
      key: "Q2025",
      end: "2028-12-31",
    });
    expect(currentPeriod("quadrennial", "2025-01-01", "2025-03-01")?.key).toBe("Q2025");
  });
});

describe("periodsThisYear", () => {
  it("lists every period of the year for calendar cadences", () => {
    expect(periodsThisYear("monthly", "2026-11-11").map((p) => p.key)).toHaveLength(12);
    expect(periodsThisYear("quarterly", "2026-11-11").map((p) => p.key)).toEqual([
      "2026-Q1",
      "2026-Q2",
      "2026-Q3",
      "2026-Q4",
    ]);
    expect(periodsThisYear("anniversary", "2026-11-11", "2025-03-01")).toHaveLength(1);
    expect(periodsThisYear("perk", "2026-11-11")).toEqual([]);
  });
});

describe("date helpers", () => {
  it("counts days across month and year boundaries", () => {
    expect(daysBetween("2026-11-11", "2026-11-30")).toBe(19);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("finds the next annual fee date", () => {
    expect(nextAnniversary("2025-03-01", "2026-11-11")).toBe("2027-03-01");
    expect(nextAnniversary("2021-12-27", "2026-11-11")).toBe("2026-12-27");
    expect(nextAnniversary("2021-11-11", "2026-11-11")).toBe("2026-11-11");
  });

  it("reads today in the configured time zone, not UTC", () => {
    const lateEvening = new Date("2026-12-01T03:30:00Z");
    expect(todayIn("America/New_York", lateEvening)).toBe("2026-11-30");
    expect(todayIn("UTC", lateEvening)).toBe("2026-12-01");
  });
});

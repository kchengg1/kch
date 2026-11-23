import { describe, expect, it } from "vitest";
import { breakEvenStatus, yearProgressPct } from "./worth";

describe("yearProgressPct", () => {
  it("returns 1 on Jan 1 and 100 on Dec 31", () => {
    expect(yearProgressPct("2026-01-01")).toBe(1);
    expect(yearProgressPct("2026-12-31")).toBe(100);
  });

  it("handles mid-year and leap years accurately", () => {
    expect(yearProgressPct("2026-07-02")).toBe(50);
    expect(yearProgressPct("2024-07-02")).toBe(50);
    expect(yearProgressPct("2024-12-31")).toBe(100);
  });
});

describe("breakEvenStatus", () => {
  it("returns null for $0 annual fee", () => {
    expect(breakEvenStatus(10000, 0, "2026-06-15")).toBeNull();
    expect(breakEvenStatus(0, -100, "2026-06-15")).toBeNull();
  });

  it("marks covered when captured meets or exceeds the annual fee", () => {
    expect(breakEvenStatus(69500, 69500, "2026-06-15")).toEqual({
      pct: 100,
      expectedPct: yearProgressPct("2026-06-15"),
      remainingCents: 0,
      netCents: 0,
      state: "covered",
    });

    expect(breakEvenStatus(104250, 69500, "2026-06-15")).toEqual({
      pct: 150,
      expectedPct: yearProgressPct("2026-06-15"),
      remainingCents: 0,
      netCents: 34750,
      state: "covered",
    });
  });

  it("caps pct at 99 when still $1 short of the fee", () => {
    const status = breakEvenStatus(69400, 69500, "2026-12-31");
    expect(status?.pct).toBe(99);
    expect(status?.remainingCents).toBe(100);
    expect(status?.netCents).toBe(-100);
    expect(status?.state).toBe("on-pace");
  });

  it("marks on-pace early in the year or within the 5pp grace buffer", () => {
    // Feb 15 is ~13% into the year; 15% recovered is on pace.
    const early = breakEvenStatus(15000, 100000, "2026-02-15");
    expect(early?.state).toBe("on-pace");
    expect(early?.pct).toBe(15);

    // Mid-year (50% elapsed); 45% recovered is right on the 5pp grace boundary.
    const grace = breakEvenStatus(45000, 100000, "2026-07-02");
    expect(grace?.expectedPct).toBe(50);
    expect(grace?.state).toBe("on-pace");
  });

  it("marks behind when recovery trails year elapsed by more than 5pp", () => {
    const behind = breakEvenStatus(25000, 100000, "2026-07-02");
    expect(behind).toEqual({
      pct: 25,
      expectedPct: 50,
      remainingCents: 75000,
      netCents: -75000,
      state: "behind",
    });
  });
});

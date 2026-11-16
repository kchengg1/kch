import { describe, expect, it } from "vitest";
import { creditBreakdown, groupStandings, ordinal, type GroupCard } from "./group-standings";
import { currentPeriod, periodsThisYear } from "./periods";
import type { BenefitRow, CardSummary, UsageRow } from "./summary";

const people = [
  { id: "me", name: "Kevin Cheng" },
  { id: "ann", name: "Ann Lee" },
  { id: "bob", name: "Bob" },
];

let n = 0;
const summary = (
  userId: string,
  templateKey: string | null,
  capturedCents: number,
  availableCents: number,
): CardSummary<GroupCard> => ({
  card: {
    id: `c${++n}`,
    userId,
    name: templateKey ?? "Custom",
    issuer: "American Express",
    templateKey,
    annualFeeCents: 0,
    openedOn: null,
    closed: false,
  },
  capturedCents,
  availableCents,
  nextFeeOn: null,
});

describe("groupStandings", () => {
  it("ranks people by credits used across their cards", () => {
    const { leaderboard } = groupStandings(
      [
        summary("me", "gold", 10000, 42400),
        summary("ann", "gold", 30000, 42400),
        summary("ann", "plat", 50000, 150000),
        summary("bob", "gold", 20000, 42400),
      ],
      people,
      new Set(),
      "me",
    );
    expect(leaderboard.map((s) => [s.firstName, s.capturedCents])).toEqual([
      ["Ann", 80000],
      ["Bob", 20000],
      ["Kevin", 10000],
    ]);
  });

  it("places each card among holders of the same card", () => {
    const { cardsByPerson } = groupStandings(
      [
        summary("me", "gold", 10000, 42400),
        summary("ann", "gold", 30000, 42400),
        summary("ann", "plat", 50000, 150000),
        summary("bob", null, 0, 0),
      ],
      people,
      new Set(),
      "me",
    );
    const ann = cardsByPerson.get("ann")!;
    expect(ann.map((c) => [c.name, c.place])).toEqual([
      ["plat", null],
      ["gold", { rank: 1, of: 2 }],
    ]);
    expect(cardsByPerson.get("me")![0]!.place).toEqual({ rank: 2, of: 2 });
  });

  it("leaves out people who stopped sharing, but never the viewer", () => {
    const { leaderboard, cardsByPerson } = groupStandings(
      [
        summary("me", "gold", 10000, 42400),
        summary("ann", "gold", 30000, 42400),
        summary("bob", "gold", 20000, 42400),
      ],
      people,
      new Set(["ann", "me"]),
      "me",
    );
    expect(leaderboard.map((s) => s.firstName)).toEqual(["Bob", "Kevin"]);
    expect(cardsByPerson.has("ann")).toBe(false);
    expect(cardsByPerson.get("bob")![0]!.place).toEqual({ rank: 1, of: 2 });
  });

  it("skips people whose cards have no credits from the leaderboard", () => {
    const { leaderboard, cardsByPerson } = groupStandings(
      [summary("bob", null, 0, 0)],
      people,
      new Set(),
      "me",
    );
    expect(leaderboard).toEqual([]);
    expect(cardsByPerson.get("bob")).toHaveLength(1);
  });
});

describe("ordinal", () => {
  it("formats places", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });
});

describe("creditBreakdown", () => {
  const today = "2026-11-16";
  const card = { id: "gold", name: "Gold", annualFeeCents: 32500, openedOn: null, closed: false };
  const benefit = (over: Partial<BenefitRow>): BenefitRow => ({
    id: Math.random().toString(36),
    cardId: "gold",
    name: "Credit",
    cadence: "annual",
    amountCents: 10000,
    notes: "",
    enrollRequired: false,
    enrolled: true,
    tracked: true,
    endsOn: null,
    sortOrder: 0,
    ...over,
  });
  const months = periodsThisYear("monthly", today);
  const dining = benefit({ name: "Dining", cadence: "monthly", amountCents: 1000 });
  const uber = benefit({ name: "Uber Cash", cadence: "monthly", amountCents: 1000 });
  const hotel = benefit({ name: "Hotel", cadence: "semiannual", amountCents: 5000 });
  const airline = benefit({ name: "Airline", amountCents: 20000 });
  const ended = benefit({ name: "Ended", endsOn: "2026-06-30", amountCents: 5000 });
  const other = benefit({ name: "Other card", cardId: "plat" });
  const usage: UsageRow[] = [
    // Ten months of dining; one month logged over the credit counts only $10.
    ...months.slice(0, 10).map((p, i) => ({
      benefitId: dining.id,
      periodKey: p.key,
      usedCents: i === 0 ? 5000 : 1000,
    })),
    { benefitId: uber.id, periodKey: months[0]!.key, usedCents: 1000 },
    { benefitId: ended.id, periodKey: currentPeriod("annual", today)!.key, usedCents: 5000 },
  ];
  const { used, unused } = creditBreakdown(
    card,
    [dining, uber, hotel, airline, ended, other],
    usage,
    today,
  );

  it("lists credits used, biggest first, capped at each credit's amount", () => {
    expect(used.map((l) => [l.name, l.usedCents])).toEqual([
      ["Dining", 10000],
      ["Ended", 5000],
      ["Uber Cash", 1000],
    ]);
  });

  it("lists credits with the most left this year, leaving out ended ones", () => {
    expect(unused.map((l) => [l.name, l.leftCents])).toEqual([
      ["Airline", 20000],
      ["Uber Cash", 11000],
      ["Hotel", 10000],
      ["Dining", 2000],
    ]);
  });
});

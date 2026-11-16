import { describe, expect, it } from "vitest";
import { groupStandings, ordinal, type GroupCard } from "./group-standings";
import type { CardSummary } from "./summary";

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

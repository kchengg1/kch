import { describe, expect, it } from "vitest";
import type { MobileOfferGroup } from "../types";
import {
  centsToInputDollars,
  checkRedemptionClient,
  dueLabel,
  formatCents,
  formatCpp,
  formatDate,
  formatSignedCents,
  normalizeServerUrl,
  parseDollars,
  sortOfferGroups,
} from "./format";

describe("formatCents and parseDollars", () => {
  it("formats whole and fractional dollar amounts in integer cents", () => {
    expect(formatCents(0)).toBe("$0");
    expect(formatCents(1500)).toBe("$15");
    expect(formatCents(1295)).toBe("$12.95");
    expect(formatCents(125000)).toBe("$1,250");
    expect(formatCents(-4500)).toBe("-$45");
    expect(formatSignedCents(8500)).toBe("+$85");
    expect(formatSignedCents(-2000)).toBe("-$20");
  });

  it("converts cents back to input dollar strings and parses dollar inputs", () => {
    expect(centsToInputDollars(null)).toBe("");
    expect(centsToInputDollars(9500)).toBe("95");
    expect(centsToInputDollars(1295)).toBe("12.95");
    expect(parseDollars("95")).toBe(9500);
    expect(parseDollars("$1,250.50")).toBe(125050);
    expect(parseDollars("abc")).toBeNull();
    expect(parseDollars("")).toBeNull();
  });
});

describe("date and countdown labels", () => {
  it("formats YYYY-MM-DD strings without UTC timezone drift", () => {
    expect(formatDate("2026-11-30", "2026-11-15")).toBe("Nov 30");
    expect(formatDate("2027-01-15", "2026-11-15")).toBe("Jan 15, 2027");
    expect(formatDate("2026-06-05")).toBe("Jun 5, 2026");
  });

  it("formats days left clearly", () => {
    expect(dueLabel(0)).toBe("Ends today");
    expect(dueLabel(1)).toBe("1 day left");
    expect(dueLabel(14)).toBe("14 days left");
    expect(dueLabel(-2)).toBe("Ended");
    expect(dueLabel(null)).toBe("");
  });
});

describe("points calculator and cpp formatting", () => {
  it("evaluates whether points beat paying cash", () => {
    expect(formatCpp(2)).toBe("2¢");
    expect(formatCpp(1.75)).toBe("1.75¢");

    const good = checkRedemptionClient({
      cashDollars: "650",
      pointsText: "25,000",
      feesDollars: "5.60",
      valueCentsPerPoint: 2.0,
    });
    expect(good).not.toBeNull();
    expect(good?.verdict).toBe("points");
    expect(good?.gainCents).toBe(14440);

    const weak = checkRedemptionClient({
      cashDollars: "220",
      pointsText: "20000",
      feesDollars: "20",
      valueCentsPerPoint: 1.7,
    });
    expect(weak?.verdict).toBe("cash");
  });
});

describe("offer group sorting and server URL normalization", () => {
  const sample: MobileOfferGroup[] = [
    {
      key: "a",
      merchant: "Airline",
      details: "Spend $500, get $100 back",
      valueCents: 10000,
      maxCents: 10000,
      rate: 0.2,
      rateLabel: "20% back",
      weak: false,
      expiresOn: "2026-12-20",
      daysLeft: 35,
      items: [],
    },
    {
      key: "b",
      merchant: "Coffee",
      details: "Spend $20, get $10 back",
      valueCents: 1000,
      maxCents: 1000,
      rate: 0.5,
      rateLabel: "50% back",
      weak: false,
      expiresOn: "2026-11-25",
      daysLeft: 10,
      items: [],
    },
  ];

  it("sorts offers by return, value, or expiry", () => {
    expect(sortOfferGroups(sample, "return").map((g) => g.key)).toEqual(["b", "a"]);
    expect(sortOfferGroups(sample, "value").map((g) => g.key)).toEqual(["a", "b"]);
    expect(sortOfferGroups(sample, "expiry").map((g) => g.key)).toEqual(["b", "a"]);
  });

  it("normalizes server URLs and rejects invalid schemes", () => {
    expect(normalizeServerUrl(" https://perks.example.com/ ")).toBe("https://perks.example.com");
    expect(normalizeServerUrl("http://192.168.1.10:3100///")).toBe("http://192.168.1.10:3100");
    expect(normalizeServerUrl("perks.example.com")).toBeNull();
    expect(normalizeServerUrl("")).toBeNull();
  });
});

describe("which card ranking", async () => {
  const { classify, rankCards } = await import("./earn");

  it("ranks open cards by earn rate times point valuation", () => {
    const target = classify("Whole Foods");
    expect(target.category).toBe("groceries");
    const picks = rankCards(
      [
        {
          id: "1",
          name: "Amex Gold",
          templateKey: "amex-gold",
          issuer: "American Express",
          closed: false,
        },
        {
          id: "2",
          name: "Venture X",
          templateKey: "capital-one-venture-x",
          issuer: "Capital One",
          closed: false,
        },
      ],
      target,
      (program) => (program.includes("Membership Rewards") ? 2.0 : 1.4),
    );
    expect(picks[0]?.cardName).toBe("Amex Gold");
    expect(picks[0]?.x).toBe(4);
    expect(picks[0]?.returnPct).toBe(8);
  });
});

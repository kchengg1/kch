import { describe, expect, it } from "vitest";
import { checkEligibility, fiveTwentyFour, type BonusOffer, type HistoryCard } from "./eligibility";

const TODAY = "2026-11-11";
const card = (over: Partial<HistoryCard>): HistoryCard => ({
  name: "Card",
  issuer: "Chase",
  business: false,
  templateKey: null,
  openedOn: "2020-01-01",
  closed: false,
  ...over,
});
const offer = (over: Partial<BonusOffer>): BonusOffer => ({
  id: "x",
  card: "Card",
  issuer: "Chase",
  business: false,
  bonus: "100,000 points",
  spend: null,
  annualFee: 95,
  estValue: null,
  match: "^never$",
  ...over,
});

describe("fiveTwentyFour", () => {
  it("counts personal cards from the last 24 months, open or closed", () => {
    const cards = [
      card({ openedOn: "2026-04-19" }),
      card({ openedOn: "2025-03-01", closed: true }),
      card({ openedOn: "2026-02-17", business: true }),
      card({ openedOn: "2024-11-01" }),
      card({ openedOn: null }),
    ];
    expect(fiveTwentyFour(cards, TODAY)).toBe(2);
  });
});

describe("checkEligibility", () => {
  it("rules out a card you already hold", () => {
    const v = checkEligibility(
      offer({ templateKey: "chase-sapphire-reserve" }),
      [card({ name: "CSR", templateKey: "chase-sapphire-reserve" })],
      TODAY,
    );
    expect(v.status).toBe("ineligible");
    expect(v.reasons[0]).toMatch(/currently hold CSR/);
  });

  it("applies the Amex once-per-lifetime rule, with the NLL exception", () => {
    const history = [
      card({ name: "Marriott Bonvoy Brilliant", issuer: "American Express", closed: true }),
    ];
    const brilliant = offer({ issuer: "American Express", match: "bonvoy brilliant" });
    expect(checkEligibility(brilliant, history, TODAY).status).toBe("ineligible");
    expect(
      checkEligibility({ ...brilliant, noLifetimeLanguage: true }, history, TODAY).status,
    ).toBe("caution");
    expect(checkEligibility(brilliant, [], TODAY).status).toBe("eligible");
  });

  it("blocks Chase cards at 5/24 and reports the count below it", () => {
    const five = Array.from({ length: 5 }, () => card({ openedOn: "2026-01-01" }));
    expect(checkEligibility(offer({}), five, TODAY).status).toBe("ineligible");
    const two = checkEligibility(offer({}), five.slice(0, 2), TODAY);
    expect(two.status).toBe("eligible");
    expect(two.reasons).toEqual(["You are at 2/24, under Chase's limit of 5."]);
  });

  it("cautions on Capital One cards opened in the last six months", () => {
    const venture = offer({ issuer: "Capital One", match: "venture(?! x)" });
    const recent = [card({ issuer: "Capital One", name: "Savor", openedOn: "2026-08-01" })];
    expect(checkEligibility(venture, recent, TODAY).status).toBe("caution");
    // Venture X is a different product and an old account, so it does not block Venture.
    const ventureX = [
      card({ issuer: "Capital One", name: "Capital One Venture X", openedOn: "2021-12-27" }),
    ];
    expect(checkEligibility(venture, ventureX, TODAY).status).toBe("eligible");
  });
});

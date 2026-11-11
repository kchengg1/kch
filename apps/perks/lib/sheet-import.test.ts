import { describe, expect, it } from "vitest";
import { parseCardSheet, parseSheetDate, parseTsv } from "./sheet-import";

const HEADER =
  "Card Name\tApproval Date\tBonus Post Date\tClosed/PC Date\tMSR Date\tAnnual Fee\tBank\tCard Type\tClosed";
const sheet = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseTsv", () => {
  it("keeps tabs and newlines inside quoted cells", () => {
    expect(parseTsv('a\t"line one\nline ""two"""\tc\nd')).toEqual([
      ["a", 'line one\nline "two"', "c"],
      ["d"],
    ]);
  });
});

describe("parseSheetDate", () => {
  it("reads US and ISO dates and rejects impossible ones", () => {
    expect(parseSheetDate("3/1/2025")).toBe("2025-03-01");
    expect(parseSheetDate("12/27/21")).toBe("2021-12-27");
    expect(parseSheetDate("2026-04-19")).toBe("2026-04-19");
    expect(parseSheetDate("2/30/2025")).toBeNull();
    expect(parseSheetDate("")).toBeNull();
  });
});

describe("parseCardSheet", () => {
  it("maps spreadsheet nicknames to catalog cards", () => {
    const { cards } = parseCardSheet(
      sheet(
        "Amex PRG\t2/18/2018\t\t\t\t$325.00\tAmerican Express\tPersonal\tNo",
        "Amex Business PRG\t6/4/2024\t\t\t\t$375.00\tAmerican Express\tBusiness\tNo",
        "Chase Sapphire Reserve\t3/1/2025\t\t\t\t$550.00\tChase\tPersonal\tNo",
        "Chase World of Hyatt Business\t2/17/2026\t\t\t\t$95.00\tChase\tBusiness\tNo",
        "Chase World of Hyatt\t4/19/2026\t\t\t\t$95.00\tChase\tPersonal\tNo",
        "Capital One Venture X\t12/27/2021\t\t\t\t$395.00\tCapital One\tPersonal\tNo",
        "Capital One Venture X Business\t2/2/2024\t\t2/23/2025\t\t$395.00\tCapital One\tBusiness\tYes",
        "Amex Delta Platinum\t4/27/2021\t\t\t\t$250.00\tAmerican Express\tPersonal\tYes",
      ),
    );
    expect(cards.map((c) => c.templateKey)).toEqual([
      "amex-gold",
      "amex-business-gold",
      "chase-sapphire-reserve",
      "chase-hyatt-business",
      "chase-hyatt",
      "capital-one-venture-x",
      "capital-one-venture-x-business",
      null,
    ]);
  });

  it("uses the catalog's current fee and business flag over stale sheet values", () => {
    const { cards } = parseCardSheet(
      sheet("Amex Business Platinum #3\t7/27/2024\t\t\t\t$695.00\tAmerican Express\tPersonal\tNo"),
    );
    expect(cards[0]).toMatchObject({
      templateKey: "amex-business-platinum",
      business: true,
      annualFeeCents: 89500,
      openedOn: "2024-07-27",
      closed: false,
    });
  });

  it("keeps sheet values for cards outside the catalog", () => {
    const { cards } = parseCardSheet(
      sheet("Barclays Aviator\t5/30/2018\t\t6/1/2019\t\t$95.00\tBarclays\tPersonal\tYes"),
    );
    expect(cards[0]).toMatchObject({
      issuer: "Barclays",
      templateKey: null,
      business: false,
      annualFeeCents: 9500,
      closed: true,
      closedOn: "2019-06-01",
    });
  });

  it("treats a product-change date on an open card as still open", () => {
    const { cards } = parseCardSheet(
      sheet("Amex Everyday\t8/1/2014\t\t2/11/2023\t\t$0.00\tAmerican Express\tPersonal\tNo"),
    );
    expect(cards[0]).toMatchObject({ closed: false, closedOn: null });
  });

  it("skips blank rows and explains a missing header", () => {
    expect(parseCardSheet(sheet("", "\t\t\t", "Discover IT\t3/1/2014")).cards).toHaveLength(1);
    expect(parseCardSheet("just some text").error).toMatch(/Card Name/);
  });
});

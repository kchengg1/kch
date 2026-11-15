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
    expect(parseCardSheet("").error).toMatch(/one per line/);
  });
});

describe("onStatement", () => {
  it("knows which credits are applied in an app rather than on the statement", async () => {
    const { onStatement } = await import("./catalog");
    expect(onStatement("chase-sapphire-reserve", "Lyft credit")).toBe(false);
    expect(onStatement("chase-sapphire-reserve", "DoorDash credit")).toBe(false);
    expect(onStatement("capital-one-venture-x", "Travel credit")).toBe(false);
    expect(onStatement("amex-gold", "Uber Cash")).toBe(false);
    // The Sapphire Reserve travel credit does post as a statement credit.
    expect(onStatement("chase-sapphire-reserve", "Travel credit")).toBe(true);
    expect(onStatement("amex-gold", "Resy credit")).toBe(true);
    // Custom cards and renamed benefits are assumed to post.
    expect(onStatement(null, "Lyft credit")).toBe(true);
  });
});

describe("parseCardList", () => {
  it("reads a typed list of cards and matches them to the catalog", () => {
    const list = `Discover It
Amex Everyday
Chase Freedom Unlimited
Chase Freedom
Chase Freedom Flex
Chase Sapphire Pref
Amex Gold Personal
Amex Plat Personal #1
Chase Ink Business Cash
Chase Ink Business Unlimited
Venture X Personal
Chase Aeroplan Card
Citi AAdvantage Card
Chase Sapphire Reserved
Amex Plat Personal #2`;
    const { cards, error } = parseCardSheet(list);
    expect(error).toBeUndefined();
    expect(cards.map((c) => [c.name, c.templateKey])).toEqual([
      ["Discover It", "discover-it"],
      ["Amex Everyday", "amex-everyday"],
      ["Chase Freedom Unlimited", "chase-freedom-unlimited"],
      ["Chase Freedom", "chase-freedom"],
      ["Chase Freedom Flex", "chase-freedom-flex"],
      ["Chase Sapphire Pref", "chase-sapphire-preferred"],
      ["Amex Gold Personal", "amex-gold"],
      ["Amex Plat Personal #1", "amex-platinum"],
      ["Chase Ink Business Cash", "chase-ink-business-cash"],
      ["Chase Ink Business Unlimited", "chase-ink-business-unlimited"],
      ["Venture X Personal", "capital-one-venture-x"],
      ["Chase Aeroplan Card", "chase-aeroplan"],
      ["Citi AAdvantage Card", "citi-aadvantage-platinum-select"],
      ["Chase Sapphire Reserved", "chase-sapphire-reserve"],
      ["Amex Plat Personal #2", "amex-platinum"],
    ]);
    expect(cards.every((c) => !c.closed && c.openedOn === null)).toBe(true);
    expect(cards.find((c) => c.name === "Chase Ink Business Cash")?.business).toBe(true);
  });

  it("matches the other list's shorthand", () => {
    const names = [
      "Amex plat",
      "Amex gold",
      "Amex everyday",
      "Amex blue business",
      "Chase preferred",
      "Costco citi",
      "Citi double cash",
    ];
    expect(parseCardSheet(names.join("\n")).cards.map((c) => c.templateKey)).toEqual([
      "amex-platinum",
      "amex-gold",
      "amex-everyday",
      "amex-blue-business-plus",
      null,
      "costco-citi",
      "citi-double-cash",
    ]);
  });

  it("takes an optional opened date and ignores bullets", () => {
    const { cards } = parseCardSheet(
      "- Chase Sapphire Pref, 3/2024\n2. Amex Gold Personal\t2/18/2018\n• Citi Double Cash",
    );
    expect(cards.map((c) => [c.name, c.openedOn])).toEqual([
      ["Chase Sapphire Pref", "2024-03-01"],
      ["Amex Gold Personal", "2018-02-18"],
      ["Citi Double Cash", null],
    ]);
  });

  it("keeps commas that are part of a name", () => {
    expect(parseCardSheet("Card one, the good one").cards[0]?.name).toBe("Card one, the good one");
  });
});

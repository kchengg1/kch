import { describe, expect, it } from "vitest";
import { parseStatementCsv, suggestBenefit } from "./statement-import";

// Amex: charges positive, credits negative, extra columns.
const AMEX = `Date,Description,Amount,Extended Details,Appears On Your Statement As
03/02/2026,"RESY CREDIT",-50.00,"Resy credit","AMEX RESY CREDIT"
03/01/2026,"SHAKE SHACK NEW YORK NY",24.18,"",""
03/05/2026,"AUTOPAY PAYMENT - THANK YOU",-1200.00,"",""
03/06/2026,"AMAZON.COM",58.10,"",""
03/07/2026,"Platinum Digital Entertainment Credit",-25.00,"",""
03/09/2026,"NORDSTROM RETURN",-40.00,"",""
13/40/2026,"BAD DATE",10.00,"",""`;

// Chase: charges negative, credits positive, Type column, payments typed Payment.
const CHASE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
02/14/2026,02/15/2026,TRAVEL CREDIT,Travel,Adjustment,"300.00",
02/10/2026,02/11/2026,UNITED AIRLINES,Travel,Sale,-412.40,
02/12/2026,02/12/2026,Payment Thank You-Mobile,,Payment,"1,500.00",
02/20/2026,02/21/2026,DOORDASH*SWEETGREEN,Food & Drink,Sale,-18.22,`;

describe("parseStatementCsv", () => {
  it("finds credits in an Amex file and skips payments and bad rows", () => {
    const { credits, charges, error } = parseStatementCsv(AMEX);
    expect(error).toBeUndefined();
    expect(charges).toBe(2);
    expect(credits).toEqual([
      { date: "2026-03-02", description: "RESY CREDIT", amountCents: 5000 },
      {
        date: "2026-03-07",
        description: "Platinum Digital Entertainment Credit",
        amountCents: 2500,
      },
      { date: "2026-03-09", description: "NORDSTROM RETURN", amountCents: 4000 },
    ]);
  });

  it("works out the opposite sign convention in a Chase file", () => {
    const { credits, charges } = parseStatementCsv(CHASE);
    expect(charges).toBe(2);
    expect(credits).toEqual([
      { date: "2026-02-14", description: "TRAVEL CREDIT", amountCents: 30000 },
    ]);
  });

  it("reads the signs right even when credits outnumber purchases", () => {
    const onlyCredits = `Date,Description,Amount
01/02/2026,AMEX DINING CREDIT,-10.00
02/02/2026,AMEX DINING CREDIT,-10.00
02/03/2026,GRUBHUB,12.00`;
    expect(parseStatementCsv(onlyCredits).credits.map((c) => c.date)).toEqual([
      "2026-01-02",
      "2026-02-02",
    ]);
  });

  it("reads Capital One's separate Debit and Credit columns", () => {
    const capitalOne = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-11-08,2026-11-09,0000,STREAMING SERVICE,Entertainment,2.99,
2026-11-01,2026-11-02,0000,CAPITAL ONE AUTOPAY PYMT,Payment/Credit,,4488.65
2026-09-04,2026-09-07,0000,PET STORE,Merchandise,,13.00
2026-08-02,2026-08-03,0000,CAPITAL ONE MOBILE PYMT,Payment/Credit,,1160.27
2026-02-20,2026-02-21,0000,APP STORE,Internet,,20.13
2026-01-21,2026-01-23,0000,"CONVENIENCE STORE CO.,LTD",Other Services,6.83,
2026-01-14,2026-01-15,0000,CAPITAL ONE TRAVEL CREDIT,Payment/Credit,,300.00`;
    const { credits, charges, error } = parseStatementCsv(capitalOne);
    expect(error).toBeUndefined();
    expect(charges).toBe(2);
    expect(credits).toEqual([
      { date: "2026-01-14", description: "CAPITAL ONE TRAVEL CREDIT", amountCents: 30000 },
      { date: "2026-02-20", description: "APP STORE", amountCents: 2013 },
      { date: "2026-09-04", description: "PET STORE", amountCents: 1300 },
    ]);
  });

  it("accepts tab-separated text and parenthesised negatives", () => {
    const text =
      "Date\tDescription\tAmount\n01/03/2026\tSTARBUCKS\t5.00\n01/04/2026\tSTARBUCKS\t6.00\n01/05/2026\tDELL CREDIT\t(150.00)";
    expect(parseStatementCsv(text).credits).toEqual([
      { date: "2026-01-05", description: "DELL CREDIT", amountCents: 15000 },
    ]);
  });

  it("explains a file without the needed columns", () => {
    expect(parseStatementCsv("Card Name,Approval Date\nCSR,3/1/2025").error).toMatch(/Amount/);
  });
});

describe("suggestBenefit", () => {
  const benefits = [
    { id: "resy", name: "Resy dining credit" },
    { id: "ent", name: "Digital entertainment credit" },
    { id: "uber", name: "Uber Cash" },
    { id: "hotel", name: "Hotel credit (Fine Hotels + Resorts / Hotel Collection)" },
    { id: "travel", name: "Travel credit" },
    { id: "edit", name: "The Edit hotel credit" },
    { id: "wireless", name: "Wireless credit" },
    { id: "dell", name: "Dell Technologies credit" },
  ];
  const pick = (d: string) => suggestBenefit(d, benefits)?.id ?? null;

  it("matches on the distinctive words of the benefit name", () => {
    expect(pick("AMEX RESY CREDIT")).toBe("resy");
    expect(pick("Platinum Digital Entertainment Credit")).toBe("ent");
    expect(pick("TRAVEL CREDIT")).toBe("travel");
    expect(pick("DELL TECHNOLOGIES CREDIT")).toBe("dell");
    expect(pick("AMEX FHR CREDIT")).toBe("hotel");
    expect(pick("VERIZON WIRELESS STATEMENT CREDIT")).toBe("wireless");
  });

  it("returns null for ordinary refunds rather than guessing", () => {
    expect(pick("NORDSTROM RETURN")).toBeNull();
    expect(pick("Statement credit")).toBeNull();
  });
});

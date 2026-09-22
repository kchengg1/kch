import { describe, expect, it } from "vitest";
import type { Account, Order, Position } from "./alpaca";
import { RiskLimitsSchema } from "./config";
import { checkOrder, type RiskContext } from "./risk";

const limits = RiskLimitsSchema.parse({});

const account: Account = {
  equity: 1000,
  lastEquity: 1000,
  cash: 1000,
  buyingPower: 1000,
  optionsBuyingPower: 1000,
  daytradeCount: 0,
  patternDayTrader: false,
  tradingBlocked: false,
  optionsTradingLevel: 2,
};

function ctx(over: Partial<RiskContext> = {}): RiskContext {
  return {
    account,
    clock: { isOpen: true, timestamp: "", nextOpen: "", nextClose: "" },
    positions: [],
    openOrders: [],
    ordersSubmittedToday: 0,
    boughtToday: new Set(),
    quote: { bid: 9.9, ask: 10 },
    today: "2026-09-22",
    limits,
    ...over,
  };
}

const position = (symbol: string, qty: number, price: number): Position => ({
  symbol,
  assetClass: "us_equity",
  qty,
  avgEntryPrice: price,
  currentPrice: price,
  marketValue: qty * price,
  unrealizedPl: 0,
  unrealizedPlPct: 0,
});

const order = (o: Partial<Order>): Order => ({
  id: "o1",
  symbol: "XYZ",
  side: "buy",
  qty: 1,
  filledQty: 0,
  type: "limit",
  limitPrice: 10,
  status: "new",
  submittedAt: "",
  filledAt: null,
  filledAvgPrice: null,
  ...o,
});

const buy = (symbol: string, qty: number, limitPrice: number) => ({
  symbol,
  side: "buy" as const,
  qty,
  limitPrice,
});
const sell = (symbol: string, qty: number, limitPrice: number) => ({
  symbol,
  side: "sell" as const,
  qty,
  limitPrice,
});

describe("checkOrder: buys", () => {
  it("accepts a stock buy inside every limit", () => {
    expect(checkOrder(buy("AMD", 30, 10), ctx())).toEqual({ ok: true, notional: 300 });
  });

  it("rejects when the market is closed", () => {
    const r = checkOrder(
      buy("AMD", 1, 10),
      ctx({ clock: { isOpen: false, timestamp: "", nextOpen: "", nextClose: "" } }),
    );
    expect(r.ok).toBe(false);
  });

  it("caps a position at maxPositionPct of equity, counting what is already held", () => {
    expect(checkOrder(buy("AMD", 41, 10), ctx()).ok).toBe(false);
    const held = ctx({ positions: [position("AMD", 30, 10)] });
    expect(checkOrder(buy("AMD", 10, 10), held).ok).toBe(true);
    expect(checkOrder(buy("AMD", 11, 10), held).ok).toBe(false);
  });

  it("never spends more than free cash, including cash reserved by working buys", () => {
    const r = checkOrder(
      buy("AMD", 30, 10),
      ctx({
        account: { ...account, cash: 500 },
        openOrders: [order({ symbol: "SPY", qty: 30, limitPrice: 10 })],
      }),
    );
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/cash/);
  });

  it("rejects limits too far above the ask and buys without a quote", () => {
    expect(checkOrder(buy("AMD", 1, 10.6), ctx()).ok).toBe(false);
    expect(checkOrder(buy("AMD", 1, 10.5), ctx()).ok).toBe(true);
    expect(checkOrder(buy("AMD", 1, 10), ctx({ quote: null })).ok).toBe(false);
  });

  it("enforces the equity floor, order count, position count and duplicate orders", () => {
    expect(checkOrder(buy("AMD", 1, 10), ctx({ account: { ...account, equity: 100 } })).ok).toBe(
      false,
    );
    expect(checkOrder(buy("AMD", 1, 10), ctx({ ordersSubmittedToday: 4 })).ok).toBe(false);
    const full = ["A", "B", "C", "D"].map((s) => position(s, 1, 10));
    expect(checkOrder(buy("AMD", 1, 10), ctx({ positions: full })).ok).toBe(false);
    expect(checkOrder(buy("A", 1, 10), ctx({ positions: full })).ok).toBe(true);
    expect(checkOrder(buy("AMD", 1, 10), ctx({ openOrders: [order({ symbol: "AMD" })] })).ok).toBe(
      false,
    );
  });

  it("rejects fractional quantities and junk symbols", () => {
    expect(checkOrder(buy("AMD", 1.5, 10), ctx()).ok).toBe(false);
    expect(checkOrder(buy("amd; drop", 1, 10), ctx()).ok).toBe(false);
  });
});

describe("checkOrder: options", () => {
  const call = "TSLA261120C00300000"; // expires 2026-11-20

  it("prices contracts at 100x and applies the same caps", () => {
    const q = { quote: { bid: 3.4, ask: 3.5 } };
    expect(checkOrder(buy(call, 1, 3.5), ctx(q))).toEqual({ ok: true, notional: 350 });
    expect(checkOrder(buy(call, 2, 3.5), ctx(q)).ok).toBe(false); // $700 > 40% of $1000
  });

  it("rejects contracts too close to expiry", () => {
    const r = checkOrder(buy("TSLA260923C00300000", 1, 1), ctx({ quote: { bid: 1, ask: 1 } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/expires in 1 day/);
  });

  it("requires options approval", () => {
    const r = checkOrder(
      buy(call, 1, 3.5),
      ctx({ account: { ...account, optionsTradingLevel: 1 }, quote: { bid: 3.4, ask: 3.5 } }),
    );
    expect(r.ok).toBe(false);
  });

  it("never writes options: selling a contract you do not hold is rejected", () => {
    expect(checkOrder(sell(call, 1, 3.4), ctx({ quote: { bid: 3.4, ask: 3.5 } })).ok).toBe(false);
  });
});

describe("checkOrder: sells", () => {
  const held = { positions: [position("AMD", 10, 10)] };

  it("only sells what is held", () => {
    expect(checkOrder(sell("AMD", 10, 9.9), ctx(held)).ok).toBe(true);
    expect(checkOrder(sell("AMD", 11, 9.9), ctx(held)).ok).toBe(false);
    expect(checkOrder(sell("NVDA", 1, 9.9), ctx(held)).ok).toBe(false);
  });

  it("rejects limits too far below the bid", () => {
    expect(checkOrder(sell("AMD", 1, 9.3), ctx(held)).ok).toBe(false);
  });

  it("allows closing even when below the equity floor or at the position cap", () => {
    expect(
      checkOrder(sell("AMD", 10, 9.9), ctx({ ...held, account: { ...account, equity: 50 } })).ok,
    ).toBe(true);
  });

  it("blocks a day trade once the 5-day budget is used, but only under $25k", () => {
    const sameDay = { ...held, boughtToday: new Set(["AMD"]) };
    expect(
      checkOrder(
        sell("AMD", 10, 9.9),
        ctx({ ...sameDay, account: { ...account, daytradeCount: 2 } }),
      ).ok,
    ).toBe(true);
    const r = checkOrder(
      sell("AMD", 10, 9.9),
      ctx({ ...sameDay, account: { ...account, daytradeCount: 3 } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/day trade/);
    const rich = { ...account, equity: 30_000, daytradeCount: 3 };
    expect(checkOrder(sell("AMD", 10, 9.9), ctx({ ...sameDay, account: rich })).ok).toBe(true);
  });

  it("does not count selling yesterday's position as a day trade", () => {
    expect(
      checkOrder(sell("AMD", 10, 9.9), ctx({ ...held, account: { ...account, daytradeCount: 3 } }))
        .ok,
    ).toBe(true);
  });
});

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Alpaca, AlpacaError, parseOptionSymbol } from "./alpaca";
import type { RiskLimits } from "./config";
import type { Journal } from "./journal";
import { checkOrder, type RiskContext } from "./risk";

type Json = Record<string, unknown>;

export function nyDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

const Symbols = z
  .array(z.string().regex(/^[A-Z][A-Z.]{0,5}$/))
  .min(1)
  .max(20);

const inputs = {
  get_portfolio: z.object({}),
  get_market_movers: z.object({}),
  get_stock_snapshots: z.object({ symbols: Symbols }),
  get_price_history: z.object({
    symbol: z.string().regex(/^[A-Z][A-Z.]{0,5}$/),
    timeframe: z.enum(["15Min", "1Hour", "1Day"]),
    days: z.number().int().min(1).max(365),
  }),
  get_option_chain: z.object({
    underlying: z.string().regex(/^[A-Z][A-Z.]{0,5}$/),
    type: z.enum(["call", "put"]),
    expiration_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expiration_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    strike_min: z.number().positive().optional(),
    strike_max: z.number().positive().optional(),
  }),
  get_news: z.object({
    symbols: Symbols.optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  place_order: z.object({
    symbol: z.string(),
    side: z.enum(["buy", "sell"]),
    qty: z.number(),
    limit_price: z.number(),
    rationale: z.string().min(1),
  }),
  cancel_order: z.object({ order_id: z.string().min(1) }),
  save_note: z.object({ note: z.string().min(1).max(4000) }),
};
type ToolName = keyof typeof inputs;

const obj = (properties: Json, required: string[] = []) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const symbolsProp = {
  type: "array",
  items: { type: "string" },
  description: 'Stock/ETF tickers, e.g. ["SPY","NVDA"]',
};

export const toolDefinitions: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_portfolio",
    description:
      "Account equity, cash, positions with P/L, working orders, orders already used today, day-trade count and the hard risk limits. Call this first.",
    input_schema: obj({}),
  },
  {
    name: "get_market_movers",
    description:
      "Today's top % gainers/losers and most-active stocks by volume. Good for finding momentum candidates.",
    input_schema: obj({}),
  },
  {
    name: "get_stock_snapshots",
    description: "Latest price, bid/ask, today's OHLCV and previous close for up to 20 tickers.",
    input_schema: obj({ symbols: symbolsProp }, ["symbols"]),
  },
  {
    name: "get_price_history",
    description: "OHLCV bars for one ticker over the last N calendar days.",
    input_schema: obj(
      {
        symbol: { type: "string" },
        timeframe: { type: "string", enum: ["15Min", "1Hour", "1Day"] },
        days: { type: "integer", minimum: 1, maximum: 365 },
      },
      ["symbol", "timeframe", "days"],
    ),
  },
  {
    name: "get_option_chain",
    description:
      "Option contracts for an underlying with bid/ask, last price, IV and greeks. Returns OCC symbols to use with place_order. Keep ranges narrow (a few weeks of expirations, strikes near the money).",
    input_schema: obj(
      {
        underlying: { type: "string" },
        type: { type: "string", enum: ["call", "put"] },
        expiration_from: { type: "string", description: "YYYY-MM-DD" },
        expiration_to: { type: "string", description: "YYYY-MM-DD" },
        strike_min: { type: "number" },
        strike_max: { type: "number" },
      },
      ["underlying", "type", "expiration_from", "expiration_to"],
    ),
  },
  {
    name: "get_news",
    description: "Recent news headlines and summaries, optionally filtered to tickers.",
    input_schema: obj({
      symbols: symbolsProp,
      limit: { type: "integer", minimum: 1, maximum: 30 },
    }),
  },
  {
    name: "place_order",
    description:
      "Submit a DAY limit order. buy opens/adds to a long stock or long option position; sell closes/reduces one you hold. qty is shares or option contracts (1 contract = 100 shares). Every order passes a risk check that may reject it with a reason — adjust and retry or move on.",
    input_schema: obj(
      {
        symbol: {
          type: "string",
          description: "Ticker (e.g. TSLA) or OCC option symbol (e.g. TSLA261120C00300000)",
        },
        side: { type: "string", enum: ["buy", "sell"] },
        qty: { type: "integer", minimum: 1 },
        limit_price: {
          type: "number",
          description: "Per share, or per-share option premium (e.g. 1.25 = $125/contract)",
        },
        rationale: { type: "string", description: "Thesis, target and exit plan for this order" },
      },
      ["symbol", "side", "qty", "limit_price", "rationale"],
    ),
  },
  {
    name: "cancel_order",
    description: "Cancel a working order by id.",
    input_schema: obj({ order_id: { type: "string" } }, ["order_id"]),
  },
  {
    name: "save_note",
    description:
      "Leave a note for your future runs: open theses, targets and stops per position, what to check next time, lessons learned. You have no other memory between runs.",
    input_schema: obj({ note: { type: "string" } }, ["note"]),
  },
];

export class TradingTools {
  /** Orders placed during this run, for the run summary. */
  readonly placed: { symbol: string; side: string; qty: number; limitPrice: number; id: string }[] =
    [];

  constructor(
    private alpaca: Alpaca,
    private limits: RiskLimits,
    private journal: Journal,
    private runId: string,
  ) {}

  /** Returns the tool_result text. Never throws; errors come back as `isError`. */
  async run(name: string, rawInput: unknown): Promise<{ content: string; isError: boolean }> {
    if (!(name in inputs)) return { content: `Unknown tool ${name}`, isError: true };
    const parsed = inputs[name as ToolName].safeParse(rawInput);
    if (!parsed.success)
      return { content: `Invalid input: ${parsed.error.message}`, isError: true };
    try {
      const out = await this.dispatch(name as ToolName, parsed.data);
      return { content: typeof out === "string" ? out : JSON.stringify(out), isError: false };
    } catch (err) {
      const msg =
        err instanceof AlpacaError ? err.message : err instanceof Error ? err.message : String(err);
      this.journal.event("tool_error", { runId: this.runId, tool: name, error: msg });
      return { content: msg, isError: true };
    }
  }

  private async dispatch(name: ToolName, input: unknown): Promise<unknown> {
    switch (name) {
      case "get_portfolio":
        return this.portfolio();
      case "get_market_movers":
        return this.movers();
      case "get_stock_snapshots":
        return this.snapshots((input as z.infer<(typeof inputs)["get_stock_snapshots"]>).symbols);
      case "get_price_history":
        return this.history(input as z.infer<(typeof inputs)["get_price_history"]>);
      case "get_option_chain":
        return this.optionChain(input as z.infer<(typeof inputs)["get_option_chain"]>);
      case "get_news":
        return this.news(input as z.infer<(typeof inputs)["get_news"]>);
      case "place_order":
        return this.placeOrder(input as z.infer<(typeof inputs)["place_order"]>);
      case "cancel_order": {
        const { order_id } = input as z.infer<(typeof inputs)["cancel_order"]>;
        await this.alpaca.cancelOrder(order_id);
        this.journal.event("order_canceled", { runId: this.runId, orderId: order_id });
        return `Cancel requested for ${order_id}.`;
      }
      case "save_note": {
        const { note } = input as z.infer<(typeof inputs)["save_note"]>;
        this.journal.addNote(this.runId, note);
        return "Saved.";
      }
    }
  }

  /** Everything the risk gate needs except the quote. */
  async riskState(): Promise<Omit<RiskContext, "quote">> {
    const today = nyDate();
    const [account, clock, positions, openOrders, todays] = await Promise.all([
      this.alpaca.getAccount(),
      this.alpaca.getClock(),
      this.alpaca.getPositions(),
      this.alpaca.getOrders({ status: "open" }),
      this.alpaca.getOrders({ status: "all", afterIso: `${today}T00:00:00Z` }),
    ]);
    const boughtToday = new Set(
      todays.filter((o) => o.side === "buy" && o.filledQty > 0).map((o) => o.symbol),
    );
    return {
      account,
      clock,
      positions,
      openOrders,
      ordersSubmittedToday: todays.length,
      boughtToday,
      today,
      limits: this.limits,
    };
  }

  private async portfolio() {
    const s = await this.riskState();
    return {
      date: s.today,
      market: s.clock,
      account: s.account,
      dayChangePct: s.account.lastEquity
        ? round((s.account.equity / s.account.lastEquity - 1) * 100)
        : null,
      positions: s.positions.map((p) => ({
        ...p,
        unrealizedPlPct: round(p.unrealizedPlPct * 100),
      })),
      workingOrders: s.openOrders,
      ordersUsedToday: `${s.ordersSubmittedToday}/${this.limits.maxOrdersPerDay}`,
      boughtToday: [...s.boughtToday],
      dayTrades: `${s.account.daytradeCount} used in rolling 5 days; limit ${this.limits.maxDayTrades} while equity < $25k`,
      riskLimits: this.limits,
    };
  }

  private async movers() {
    const [movers, actives] = await Promise.all([
      this.alpaca.data<Json>("/v1beta1/screener/stocks/movers?top=15"),
      this.alpaca.data<Json>("/v1beta1/screener/stocks/most-actives?by=volume&top=15"),
    ]);
    return { gainers: movers.gainers, losers: movers.losers, mostActive: actives.most_actives };
  }

  private async snapshots(symbols: string[]) {
    const r = await this.alpaca.data<Record<string, Json>>(
      `/v2/stocks/snapshots?feed=iex&symbols=${encodeURIComponent(symbols.join(","))}`,
    );
    return Object.fromEntries(
      Object.entries(r).map(([sym, s]) => {
        const q = (s.latestQuote ?? {}) as Json;
        const d = (s.dailyBar ?? {}) as Json;
        const prev = (s.prevDailyBar ?? {}) as Json;
        const last = Number(((s.latestTrade ?? {}) as Json).p ?? d.c);
        return [
          sym,
          {
            last,
            bid: q.bp,
            ask: q.ap,
            open: d.o,
            high: d.h,
            low: d.l,
            volume: d.v,
            prevClose: prev.c,
            changePct: prev.c ? round((last / Number(prev.c) - 1) * 100) : null,
          },
        ];
      }),
    );
  }

  private async history(i: z.infer<(typeof inputs)["get_price_history"]>) {
    const start = new Date(Date.now() - i.days * 86_400_000).toISOString();
    const q = new URLSearchParams({
      symbols: i.symbol,
      timeframe: i.timeframe,
      start,
      limit: "1000",
      feed: "iex",
    });
    const r = await this.alpaca.data<{ bars?: Record<string, Json[]> }>(`/v2/stocks/bars?${q}`);
    const bars = (r.bars?.[i.symbol] ?? []).slice(-200);
    return {
      symbol: i.symbol,
      timeframe: i.timeframe,
      columns: "t,o,h,l,c,v",
      bars: bars.map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]),
    };
  }

  private async optionChain(i: z.infer<(typeof inputs)["get_option_chain"]>) {
    const q = new URLSearchParams({
      feed: "indicative",
      type: i.type,
      expiration_date_gte: i.expiration_from,
      expiration_date_lte: i.expiration_to,
      limit: "250",
    });
    if (i.strike_min) q.set("strike_price_gte", String(i.strike_min));
    if (i.strike_max) q.set("strike_price_lte", String(i.strike_max));
    const r = await this.alpaca.data<{ snapshots?: Record<string, Json> }>(
      `/v1beta1/options/snapshots/${encodeURIComponent(i.underlying)}?${q}`,
    );
    const rows = Object.entries(r.snapshots ?? {}).flatMap(([sym, s]) => {
      const occ = parseOptionSymbol(sym);
      if (!occ) return [];
      const quote = (s.latestQuote ?? {}) as Json;
      const greeks = (s.greeks ?? {}) as Json;
      return [
        {
          symbol: sym,
          exp: occ.expiration,
          strike: occ.strike,
          bid: quote.bp,
          ask: quote.ap,
          last: ((s.latestTrade ?? {}) as Json).p ?? null,
          iv: s.impliedVolatility == null ? null : round(Number(s.impliedVolatility)),
          delta: greeks.delta == null ? null : round(Number(greeks.delta)),
          theta: greeks.theta == null ? null : round(Number(greeks.theta)),
        },
      ];
    });
    rows.sort((a, b) => a.exp.localeCompare(b.exp) || a.strike - b.strike);
    return {
      underlying: i.underlying,
      type: i.type,
      count: rows.length,
      contracts: rows.slice(0, 80),
    };
  }

  private async news(i: z.infer<(typeof inputs)["get_news"]>) {
    const q = new URLSearchParams({ limit: String(i.limit ?? 12), sort: "desc" });
    if (i.symbols) q.set("symbols", i.symbols.join(","));
    const r = await this.alpaca.data<{ news?: Json[] }>(`/v1beta1/news?${q}`);
    return (r.news ?? []).map((n) => ({
      at: n.created_at,
      symbols: n.symbols,
      headline: n.headline,
      summary: typeof n.summary === "string" ? n.summary.slice(0, 400) : undefined,
    }));
  }

  private async placeOrder(i: z.infer<(typeof inputs)["place_order"]>) {
    const order = {
      symbol: i.symbol.toUpperCase(),
      side: i.side,
      qty: i.qty,
      limitPrice: i.limit_price,
    };
    const state = await this.riskState();
    const quote = await this.alpaca.getQuote(order.symbol);
    const decision = checkOrder(order, { ...state, quote });
    if (!decision.ok) {
      this.journal.event("order_rejected", {
        runId: this.runId,
        order,
        quote,
        reason: decision.reason,
        rationale: i.rationale,
      });
      return `REJECTED by risk check: ${decision.reason}`;
    }
    const placed = await this.alpaca.submitOrder({
      ...order,
      clientOrderId: `${this.runId}-${state.ordersSubmittedToday + 1}`,
    });
    this.placed.push({ ...order, id: placed.id });
    this.journal.event("order_submitted", {
      runId: this.runId,
      order,
      quote,
      notional: decision.notional,
      rationale: i.rationale,
      alpaca: placed,
    });
    return {
      status: "submitted",
      id: placed.id,
      alpacaStatus: placed.status,
      notional: round(decision.notional),
      quote,
    };
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

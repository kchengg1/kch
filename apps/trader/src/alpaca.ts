/**
 * Minimal Alpaca REST client: trading API (paper or live) + market data API.
 * Only the endpoints the agent uses. Numeric fields arrive as strings and are
 * parsed at the edges (see `toAccount`, `toPosition`, `toOrder`).
 */

export type Account = {
  equity: number;
  lastEquity: number;
  cash: number;
  buyingPower: number;
  optionsBuyingPower: number;
  daytradeCount: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  optionsTradingLevel: number;
};

export type Position = {
  symbol: string;
  assetClass: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
};

export type Order = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  type: string;
  limitPrice: number | null;
  status: string;
  submittedAt: string;
  filledAt: string | null;
  filledAvgPrice: number | null;
};

export type Clock = { isOpen: boolean; timestamp: string; nextOpen: string; nextClose: string };

export type Quote = { bid: number; ask: number };

export type OrderRequest = {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  limitPrice: number;
  clientOrderId?: string;
};

type Json = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

export class AlpacaError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Alpaca ${status}: ${body.slice(0, 500)}`);
  }
}

export class Alpaca {
  constructor(
    private opts: { keyId: string; secretKey: string; tradingUrl: string; dataUrl: string },
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(base + path, {
      ...init,
      headers: {
        "APCA-API-KEY-ID": this.opts.keyId,
        "APCA-API-SECRET-KEY": this.opts.secretKey,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
    const text = await res.text();
    if (!res.ok) throw new AlpacaError(res.status, text);
    return (text ? JSON.parse(text) : null) as T;
  }

  private trading<T>(path: string, init?: RequestInit) {
    return this.request<T>(this.opts.tradingUrl, path, init);
  }

  data<T>(path: string) {
    return this.request<T>(this.opts.dataUrl, path);
  }

  async getAccount(): Promise<Account> {
    const a = await this.trading<Json>("/v2/account");
    return {
      equity: num(a.equity),
      lastEquity: num(a.last_equity),
      cash: num(a.cash),
      buyingPower: num(a.buying_power),
      optionsBuyingPower: num(a.options_buying_power ?? a.cash),
      daytradeCount: num(a.daytrade_count),
      patternDayTrader: Boolean(a.pattern_day_trader),
      tradingBlocked: Boolean(a.trading_blocked) || Boolean(a.account_blocked),
      optionsTradingLevel: num(a.options_trading_level),
    };
  }

  async getClock(): Promise<Clock> {
    const c = await this.trading<Json>("/v2/clock");
    return {
      isOpen: Boolean(c.is_open),
      timestamp: String(c.timestamp),
      nextOpen: String(c.next_open),
      nextClose: String(c.next_close),
    };
  }

  async getPositions(): Promise<Position[]> {
    const ps = await this.trading<Json[]>("/v2/positions");
    return ps.map((p) => ({
      symbol: String(p.symbol),
      assetClass: String(p.asset_class),
      qty: num(p.qty),
      avgEntryPrice: num(p.avg_entry_price),
      currentPrice: num(p.current_price),
      marketValue: num(p.market_value),
      unrealizedPl: num(p.unrealized_pl),
      unrealizedPlPct: num(p.unrealized_plpc),
    }));
  }

  /** Orders submitted on or after `afterIso`, any status. */
  async getOrders(opts: {
    status: "open" | "closed" | "all";
    afterIso?: string;
  }): Promise<Order[]> {
    const q = new URLSearchParams({ status: opts.status, limit: "200", direction: "desc" });
    if (opts.afterIso) q.set("after", opts.afterIso);
    const os = await this.trading<Json[]>(`/v2/orders?${q}`);
    return os.map(toOrder);
  }

  async submitOrder(o: OrderRequest): Promise<Order> {
    const body: Json = {
      symbol: o.symbol,
      side: o.side,
      qty: String(o.qty),
      type: "limit",
      limit_price: o.limitPrice.toFixed(2),
      time_in_force: "day",
    };
    if (o.clientOrderId) body.client_order_id = o.clientOrderId;
    return toOrder(
      await this.trading<Json>("/v2/orders", { method: "POST", body: JSON.stringify(body) }),
    );
  }

  async cancelOrder(id: string): Promise<void> {
    await this.trading(`/v2/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /** Current bid/ask for a stock or an OCC option symbol. */
  async getQuote(symbol: string): Promise<Quote | null> {
    const isOption = isOptionSymbol(symbol);
    const path = isOption
      ? `/v1beta1/options/quotes/latest?feed=indicative&symbols=${encodeURIComponent(symbol)}`
      : `/v2/stocks/quotes/latest?feed=iex&symbols=${encodeURIComponent(symbol)}`;
    const r = await this.data<{ quotes?: Record<string, Json> }>(path);
    const q = r.quotes?.[symbol];
    if (!q) return null;
    return { bid: num(q.bp), ask: num(q.ap) };
  }
}

function toOrder(o: Json): Order {
  return {
    id: String(o.id),
    symbol: String(o.symbol),
    side: o.side === "sell" ? "sell" : "buy",
    qty: num(o.qty),
    filledQty: num(o.filled_qty),
    type: String(o.type),
    limitPrice: o.limit_price == null ? null : num(o.limit_price),
    status: String(o.status),
    submittedAt: String(o.submitted_at),
    filledAt: o.filled_at == null ? null : String(o.filled_at),
    filledAvgPrice: o.filled_avg_price == null ? null : num(o.filled_avg_price),
  };
}

/** OCC option symbol, e.g. AAPL260117C00150000. */
const OCC = /^([A-Z]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export function isOptionSymbol(symbol: string): boolean {
  return OCC.test(symbol);
}

export function parseOptionSymbol(symbol: string) {
  const m = OCC.exec(symbol);
  if (!m) return null;
  const [, underlying, yy, mm, dd, cp, strike] = m;
  return {
    underlying: underlying!,
    expiration: `20${yy}-${mm}-${dd}`,
    type: cp === "C" ? ("call" as const) : ("put" as const),
    strike: Number(strike) / 1000,
  };
}

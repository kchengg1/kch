import { isOptionSymbol, parseOptionSymbol } from "./alpaca";
import type { Account, Clock, Order, OrderRequest, Position, Quote } from "./alpaca";
import type { RiskLimits } from "./config";

export const PDT_EQUITY_THRESHOLD = 25_000;

export type RiskContext = {
  account: Account;
  clock: Clock;
  positions: Position[];
  /** Orders still working (new, partially filled, accepted…). */
  openOrders: Order[];
  /** Orders this agent submitted today (any status). */
  ordersSubmittedToday: number;
  /** Symbols with a buy that filled today — selling them today is a day trade. */
  boughtToday: ReadonlySet<string>;
  quote: Quote | null;
  /** Today's date in New York, YYYY-MM-DD. */
  today: string;
  limits: RiskLimits;
};

export type RiskDecision = { ok: true; notional: number } | { ok: false; reason: string };

const STOCK_SYMBOL = /^[A-Z][A-Z.]{0,5}$/;

export function multiplier(symbol: string) {
  return isOptionSymbol(symbol) ? 100 : 1;
}

function daysBetween(fromYmd: string, toYmd: string) {
  return Math.round(
    (Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * The only path to the broker. Pure and deterministic so it can be tested
 * exhaustively; the model cannot bypass or reconfigure it.
 */
export function checkOrder(order: OrderRequest, ctx: RiskContext): RiskDecision {
  const { account, limits } = ctx;
  const reject = (reason: string): RiskDecision => ({ ok: false, reason });

  if (account.tradingBlocked) return reject("Account is blocked from trading.");
  if (!ctx.clock.isOpen)
    return reject("Market is closed; orders are only placed during regular hours.");
  if (!STOCK_SYMBOL.test(order.symbol) && !isOptionSymbol(order.symbol)) {
    return reject(
      `Unrecognised symbol "${order.symbol}". Use a stock ticker or an OCC option symbol.`,
    );
  }
  if (!Number.isInteger(order.qty) || order.qty <= 0)
    return reject("qty must be a positive whole number.");
  if (!(order.limitPrice > 0)) return reject("limit_price must be positive.");
  if (ctx.ordersSubmittedToday >= limits.maxOrdersPerDay) {
    return reject(`Daily order limit reached (${limits.maxOrdersPerDay}).`);
  }
  if (ctx.openOrders.some((o) => o.symbol === order.symbol)) {
    return reject(`There is already a working order for ${order.symbol}; cancel it first.`);
  }

  const mult = multiplier(order.symbol);
  const notional = order.qty * order.limitPrice * mult;
  const held = ctx.positions.find((p) => p.symbol === order.symbol);
  const heldQty = held?.qty ?? 0;
  const quote = ctx.quote;

  if (order.side === "buy") {
    if (heldQty < 0) return reject("Short positions are not supported.");
    if (account.equity < limits.minEquityToOpen) {
      return reject(
        `Equity $${account.equity.toFixed(2)} is below the $${limits.minEquityToOpen} floor for opening positions.`,
      );
    }
    if (!quote || !(quote.ask > 0))
      return reject(`No live ask for ${order.symbol}; cannot price a buy safely.`);
    const maxLimit = quote.ask * (1 + limits.maxSlippagePct);
    if (order.limitPrice > maxLimit) {
      return reject(
        `Limit $${order.limitPrice} is more than ${pct(limits.maxSlippagePct)} above the ask ($${quote.ask}). Max $${maxLimit.toFixed(2)}.`,
      );
    }

    if (!held) {
      const pendingNew = new Set(
        ctx.openOrders
          .filter((o) => o.side === "buy" && !ctx.positions.some((p) => p.symbol === o.symbol))
          .map((o) => o.symbol),
      );
      if (ctx.positions.length + pendingNew.size >= limits.maxOpenPositions) {
        return reject(`Already at the max of ${limits.maxOpenPositions} open positions.`);
      }
    }

    const exposure = Math.abs(held?.marketValue ?? 0) + notional;
    const cap = limits.maxPositionPct * account.equity;
    if (exposure > cap) {
      return reject(
        `Position would be $${exposure.toFixed(2)}, over the ${pct(limits.maxPositionPct)} of equity cap ($${cap.toFixed(2)}).`,
      );
    }

    const reserved = ctx.openOrders
      .filter((o) => o.side === "buy")
      .reduce((s, o) => s + (o.qty - o.filledQty) * (o.limitPrice ?? 0) * multiplier(o.symbol), 0);
    const spendable =
      (mult === 100 ? Math.min(account.cash, account.optionsBuyingPower) : account.cash) - reserved;
    if (notional > spendable) {
      return reject(
        `Costs $${notional.toFixed(2)} but only $${spendable.toFixed(2)} cash is free (no margin).`,
      );
    }

    if (mult === 100) {
      if (account.optionsTradingLevel < 2) {
        return reject("Account is not approved to buy options (needs options level 2).");
      }
      const occ = parseOptionSymbol(order.symbol)!;
      const dte = daysBetween(ctx.today, occ.expiration);
      if (dte < limits.minOptionDte) {
        return reject(`Contract expires in ${dte} day(s); minimum is ${limits.minOptionDte}.`);
      }
    }
    return { ok: true, notional };
  }

  // Sell: only to close or reduce an existing long. No shorting, no writing options.
  if (heldQty <= 0)
    return reject(
      `No long position in ${order.symbol} to sell. Shorting and writing options are not allowed.`,
    );
  if (order.qty > heldQty) return reject(`Can only sell up to ${heldQty} of ${order.symbol}.`);
  if (quote && quote.bid > 0) {
    const minLimit = quote.bid * (1 - limits.maxSlippagePct);
    if (order.limitPrice < minLimit) {
      return reject(
        `Limit $${order.limitPrice} is more than ${pct(limits.maxSlippagePct)} below the bid ($${quote.bid}). Min $${minLimit.toFixed(2)}.`,
      );
    }
  }
  if (ctx.boughtToday.has(order.symbol) && account.equity < PDT_EQUITY_THRESHOLD) {
    if (account.patternDayTrader)
      return reject("Account is flagged PDT under $25k; no day trades allowed.");
    if (account.daytradeCount >= limits.maxDayTrades) {
      return reject(
        `Selling ${order.symbol} today would be a day trade and ${account.daytradeCount} of ${limits.maxDayTrades} allowed are used in the 5-day window. Hold until tomorrow.`,
      );
    }
  }
  return { ok: true, notional };
}

function pct(x: number) {
  return `${Math.round(x * 1000) / 10}%`;
}

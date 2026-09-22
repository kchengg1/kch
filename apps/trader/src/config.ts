import { z } from "zod";

/**
 * Hard limits enforced in code by the risk gate. The model is told what they
 * are, but it cannot change them — only the operator (via env) can.
 */
export const RiskLimitsSchema = z.object({
  /** Max share of equity a single new buy may cost. */
  maxPositionPct: z.coerce.number().min(0.01).max(1).default(0.4),
  /** Max number of distinct open positions. */
  maxOpenPositions: z.coerce.number().int().min(1).default(4),
  /** Max orders the agent may submit per trading day (all sides). */
  maxOrdersPerDay: z.coerce.number().int().min(1).default(4),
  /** Below this equity, no new positions are opened (closing is still allowed). */
  minEquityToOpen: z.coerce.number().min(0).default(150),
  /** Limit price may be at most this far through the quote (above ask / below bid). */
  maxSlippagePct: z.coerce.number().min(0).max(0.5).default(0.05),
  /** Option contracts must have at least this many calendar days to expiry when bought. */
  minOptionDte: z.coerce.number().int().min(0).default(2),
  /** Day trades allowed in the rolling 5-day window while equity < $25k (FINRA PDT is 4+). */
  maxDayTrades: z.coerce.number().int().min(0).max(3).default(3),
});
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

const EnvSchema = z.object({
  ALPACA_API_KEY_ID: z.string().min(1, "ALPACA_API_KEY_ID is required"),
  ALPACA_API_SECRET_KEY: z.string().min(1, "ALPACA_API_SECRET_KEY is required"),
  /** "paper" (default) or "live". Live also requires TRADER_CONFIRM_LIVE=yes. */
  TRADER_MODE: z.enum(["paper", "live"]).default("paper"),
  TRADER_CONFIRM_LIVE: z.string().optional(),
  TRADER_MODEL: z.string().default("claude-opus-5"),
  TRADER_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("high"),
  /** Comma-separated ET times the daemon runs a cycle, e.g. "09:45,12:30,15:30". */
  TRADER_SCHEDULE: z.string().default("09:45,12:30,15:30"),
  TRADER_DATA_DIR: z.string().default(".data"),
  TRADER_GOAL: z.string().default("Grow the account from about $1,000 toward $100,000."),
  RISK_MAX_POSITION_PCT: z.string().optional(),
  RISK_MAX_OPEN_POSITIONS: z.string().optional(),
  RISK_MAX_ORDERS_PER_DAY: z.string().optional(),
  RISK_MIN_EQUITY_TO_OPEN: z.string().optional(),
  RISK_MAX_SLIPPAGE_PCT: z.string().optional(),
  RISK_MIN_OPTION_DTE: z.string().optional(),
  RISK_MAX_DAY_TRADES: z.string().optional(),
});

export type Config = {
  alpaca: { keyId: string; secretKey: string; tradingUrl: string; dataUrl: string };
  mode: "paper" | "live";
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  schedule: string[];
  dataDir: string;
  goal: string;
  limits: RiskLimits;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = EnvSchema.parse(env);
  if (e.TRADER_MODE === "live" && e.TRADER_CONFIRM_LIVE !== "yes") {
    throw new Error("TRADER_MODE=live requires TRADER_CONFIRM_LIVE=yes (real money).");
  }
  const schedule = e.TRADER_SCHEDULE.split(",").map((s) => s.trim());
  for (const slot of schedule) {
    if (!/^\d{2}:\d{2}$/.test(slot)) throw new Error(`Bad TRADER_SCHEDULE entry: ${slot}`);
  }
  return {
    alpaca: {
      keyId: e.ALPACA_API_KEY_ID,
      secretKey: e.ALPACA_API_SECRET_KEY,
      tradingUrl:
        e.TRADER_MODE === "live"
          ? "https://api.alpaca.markets"
          : "https://paper-api.alpaca.markets",
      dataUrl: "https://data.alpaca.markets",
    },
    mode: e.TRADER_MODE,
    model: e.TRADER_MODEL,
    effort: e.TRADER_EFFORT,
    schedule,
    dataDir: e.TRADER_DATA_DIR,
    goal: e.TRADER_GOAL,
    limits: RiskLimitsSchema.parse({
      maxPositionPct: e.RISK_MAX_POSITION_PCT,
      maxOpenPositions: e.RISK_MAX_OPEN_POSITIONS,
      maxOrdersPerDay: e.RISK_MAX_ORDERS_PER_DAY,
      minEquityToOpen: e.RISK_MIN_EQUITY_TO_OPEN,
      maxSlippagePct: e.RISK_MAX_SLIPPAGE_PCT,
      minOptionDte: e.RISK_MIN_OPTION_DTE,
      maxDayTrades: e.RISK_MAX_DAY_TRADES,
    }),
  };
}

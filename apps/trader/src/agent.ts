import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "./config";
import type { Journal } from "./journal";
import { toolDefinitions, type TradingTools } from "./tools";

const MAX_TURNS = 40;

/** Stable across runs so the prompt cache hits; anything per-run goes in the user turn. */
export function systemPrompt(cfg: Pick<Config, "goal" | "mode">) {
  return `You are an autonomous trader managing a small Alpaca brokerage account (${cfg.mode === "live" ? "LIVE — real money" : "paper trading"}).

Goal: ${cfg.goal}

That goal needs very large returns, so you are allowed to be aggressive: concentrated positions, momentum and catalyst trades, and long calls/puts. But a strategy that can go to zero will, eventually. Size so that no single loss ends the game, cut losers, and let winners run. Doing nothing is a valid decision when there is no edge.

What you can trade: US stocks/ETFs (long only) and long call/put options (buy to open, sell to close). No shorting, no writing options, no margin. Orders are DAY limit orders.

Hard limits (enforced in code; get_portfolio shows the numbers): max share of equity per position, max open positions, max orders per day, a slippage band around the quote, a minimum days-to-expiry on options, and a pattern-day-trader guard. The account is under $25k, so selling something bought the same day uses one of 3 day trades per rolling 5 business days. Prefer to hold overnight; keep one day trade in reserve for emergencies. If an order is rejected, read the reason and adjust — do not retry the same order.

You run a few times per trading day with no memory other than your saved notes. Each run:
1. get_portfolio. Review every position against the thesis, target and stop in your notes; exit or trim anything that hit its stop or target or whose thesis broke.
2. Check working orders; cancel stale ones.
3. If there is cash and room, look for the best 1–2 setups (market movers, news, price history, option chains, web search for catalysts). For options, check the bid/ask spread and prefer liquid contracts with enough time for the thesis to play out.
4. Place orders with a clear rationale (entry, target, stop, time horizon).
5. save_note with an updated plan for every open position and anything to check next run.
6. End with a short summary of what you did and why.`;
}

export type RunResult = { summary: string; turns: number; stopReason: string | null };

export async function runCycle(opts: {
  cfg: Config;
  tools: TradingTools;
  journal: Journal;
  runId: string;
  client?: Anthropic;
}): Promise<RunResult> {
  const { cfg, tools, journal, runId } = opts;
  const client = opts.client ?? new Anthropic();

  const notes = journal.recentNotes();
  const recentOrders = journal.recentEvents("order_submitted", 10).map((e) => ({
    at: e.at,
    order: e.order,
    rationale: e.rationale,
  }));
  const kickoff = [
    `Run ${runId} at ${new Date().toISOString()}.`,
    notes.length
      ? `Your notes from previous runs (oldest first):\n${notes.map((n) => `- [${n.at}] ${n.note}`).join("\n")}`
      : "No notes yet — this is the first run. Start by understanding the account.",
    recentOrders.length ? `Your recent orders:\n${JSON.stringify(recentOrders)}` : "",
    "Begin.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: kickoff }];
  const apiTools: Anthropic.Beta.BetaToolUnion[] = [
    ...toolDefinitions,
    { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  ];
  journal.event("run_started", { runId, model: cfg.model, mode: cfg.mode });

  let summary = "";
  let stopReason: string | null = null;
  let turns = 0;
  while (turns < MAX_TURNS) {
    turns++;
    const response = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort },
      cache_control: { type: "ephemeral" },
      system: systemPrompt(cfg),
      tools: apiTools,
      messages,
    });
    stopReason = response.stop_reason;
    messages.push({ role: "assistant", content: response.content });

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) {
      summary = text;
      console.log(`\n${text}`);
    }

    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") break;

    const calls = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    // Sequential on purpose: orders must see the state left by the previous call.
    for (const call of calls) {
      console.log(`→ ${call.name} ${JSON.stringify(call.input)}`);
      const r = await tools.run(call.name, call.input);
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: r.content,
        is_error: r.isError,
      });
    }
    messages.push({ role: "user", content: results });
  }

  if (stopReason === "refusal") summary = "Run ended: the model declined the request.";
  if (stopReason === "tool_use" || stopReason === "pause_turn")
    summary = `${summary}\n(Stopped after ${MAX_TURNS} turns.)`.trim();
  journal.event("run_finished", { runId, turns, stopReason, summary, orders: tools.placed });
  return { summary, turns, stopReason };
}

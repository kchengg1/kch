import type Anthropic from "@anthropic-ai/sdk";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCycle } from "./agent";
import { Alpaca } from "./alpaca";
import { loadConfig } from "./config";
import { Journal } from "./journal";
import { TradingTools } from "./tools";

const cfg = loadConfig({ ALPACA_API_KEY_ID: "k", ALPACA_API_SECRET_KEY: "s" } as NodeJS.ProcessEnv);

/** Fake Alpaca: a $1000 account holding nothing, market open, AMD quoted at 9.90/10.00. */
function fakeAlpaca() {
  const submitted: Record<string, unknown>[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const { pathname } = new URL(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (pathname === "/v2/account") {
      return json({
        equity: "1000",
        last_equity: "1000",
        cash: "1000",
        buying_power: "1000",
        options_buying_power: "1000",
        daytrade_count: 0,
        options_trading_level: 2,
      });
    }
    if (pathname === "/v2/clock")
      return json({ is_open: true, timestamp: "", next_open: "", next_close: "" });
    if (pathname === "/v2/positions") return json([]);
    if (pathname === "/v2/orders" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      submitted.push(body);
      return json({ id: `ord${submitted.length}`, ...body, filled_qty: "0", status: "accepted" });
    }
    if (pathname === "/v2/orders") return json([]);
    if (pathname === "/v2/stocks/quotes/latest")
      return json({ quotes: { AMD: { bp: 9.9, ap: 10 } } });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { alpaca: new Alpaca(cfg.alpaca, fetchImpl), submitted };
}

/** Fake Claude that plays back a fixed script of tool calls. */
function scriptedClient(script: Anthropic.Beta.BetaContentBlock[][]) {
  const requests: Anthropic.Beta.MessageCreateParams[] = [];
  let i = 0;
  const client = {
    beta: {
      messages: {
        create: async (params: Anthropic.Beta.MessageCreateParams) => {
          requests.push(structuredClone(params));
          const content = script[i++] ?? [{ type: "text", text: "done" }];
          return {
            content,
            stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const toolUse = (id: string, name: string, input: unknown) =>
  ({ type: "tool_use", id, name, input }) as Anthropic.Beta.BetaToolUseBlock;

describe("runCycle", () => {
  it("routes orders through the risk gate, submits the valid one and remembers notes", async () => {
    const { alpaca, submitted } = fakeAlpaca();
    const journal = new Journal(mkdtempSync(join(tmpdir(), "trader-")));
    const tools = new TradingTools(alpaca, cfg.limits, journal, "rtest");
    const { client, requests } = scriptedClient([
      [toolUse("t1", "get_portfolio", {})],
      [
        toolUse("t2", "place_order", {
          symbol: "AMD",
          side: "buy",
          qty: 90,
          limit_price: 10,
          rationale: "too big",
        }),
        toolUse("t3", "place_order", {
          symbol: "AMD",
          side: "sell",
          qty: 1,
          limit_price: 10,
          rationale: "short",
        }),
      ],
      [
        toolUse("t4", "place_order", {
          symbol: "AMD",
          side: "buy",
          qty: 30,
          limit_price: 10,
          rationale: "momentum",
        }),
      ],
      [toolUse("t5", "save_note", { note: "AMD: stop 9.20, target 12" })],
      [{ type: "text", text: "Bought 30 AMD.", citations: null } as Anthropic.Beta.BetaTextBlock],
    ]);

    const result = await runCycle({ cfg, tools, journal, runId: "rtest", client });

    expect(result).toMatchObject({ summary: "Bought 30 AMD.", turns: 5, stopReason: "end_turn" });
    expect(submitted).toEqual([
      {
        symbol: "AMD",
        side: "buy",
        qty: "30",
        type: "limit",
        limit_price: "10.00",
        time_in_force: "day",
        client_order_id: "rtest-1",
      },
    ]);

    const results = requests[2]!.messages.at(-1)!
      .content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results.map((r) => r.content)).toEqual([
      expect.stringMatching(/^REJECTED.*cap/),
      expect.stringMatching(/^REJECTED.*No long position/),
    ]);
    expect(journal.recentNotes().map((n) => n.note)).toEqual(["AMD: stop 9.20, target 12"]);
    expect(journal.recentEvents("order_rejected")).toHaveLength(2);
  });

  it("feeds saved notes into the next run", async () => {
    const { alpaca } = fakeAlpaca();
    const journal = new Journal(mkdtempSync(join(tmpdir(), "trader-")));
    journal.addNote("r0", "Watch NVDA earnings Wednesday");
    const { client, requests } = scriptedClient([]);
    await runCycle({
      cfg,
      tools: new TradingTools(alpaca, cfg.limits, journal, "r1"),
      journal,
      runId: "r1",
      client,
    });
    expect(requests[0]!.messages[0]!.content).toContain("Watch NVDA earnings Wednesday");
  });

  it("returns invalid tool input to the model as an error instead of throwing", async () => {
    const { alpaca } = fakeAlpaca();
    const tools = new TradingTools(
      alpaca,
      cfg.limits,
      new Journal(mkdtempSync(join(tmpdir(), "trader-"))),
      "r",
    );
    expect(await tools.run("get_price_history", { symbol: "AMD" })).toMatchObject({
      isError: true,
    });
    expect(await tools.run("nope", {})).toMatchObject({ isError: true });
  });
});

describe("loadConfig", () => {
  it("defaults to paper and refuses live without explicit confirmation", () => {
    expect(cfg.mode).toBe("paper");
    expect(cfg.alpaca.tradingUrl).toContain("paper-api");
    const base = { ALPACA_API_KEY_ID: "k", ALPACA_API_SECRET_KEY: "s", TRADER_MODE: "live" };
    expect(() => loadConfig(base as NodeJS.ProcessEnv)).toThrow(/TRADER_CONFIRM_LIVE/);
    expect(
      loadConfig({ ...base, TRADER_CONFIRM_LIVE: "yes" } as NodeJS.ProcessEnv).alpaca.tradingUrl,
    ).toBe("https://api.alpaca.markets");
  });
});

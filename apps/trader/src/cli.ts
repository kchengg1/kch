import { join } from "node:path";
import { ZodError } from "zod";
import { runCycle } from "./agent";
import { Alpaca } from "./alpaca";
import { loadConfig, type Config } from "./config";
import { Journal } from "./journal";
import { nyDate, TradingTools } from "./tools";

const USAGE = `Usage: pnpm --filter @kch/trader trade <command>

  run      Run one decision cycle now
  daemon   Stay running; run a cycle at each TRADER_SCHEDULE slot (ET) on market days
  status   Print account, positions and working orders
  notes    Print the agent's saved notes`;

function setup(cfg: Config) {
  const alpaca = new Alpaca(cfg.alpaca);
  const journal = new Journal(join(process.cwd(), cfg.dataDir, cfg.mode));
  return { alpaca, journal };
}

async function runOnce(cfg: Config) {
  const { alpaca, journal } = setup(cfg);
  const runId = `r${Date.now().toString(36)}`;
  const tools = new TradingTools(alpaca, cfg.limits, journal, runId);
  console.log(`[${cfg.mode}] run ${runId} with ${cfg.model}`);
  const result = await runCycle({ cfg, tools, journal, runId });
  console.log(`\nDone in ${result.turns} turn(s). Orders placed: ${tools.placed.length}`);
  for (const o of tools.placed)
    console.log(`  ${o.side} ${o.qty} ${o.symbol} @ ${o.limitPrice} (${o.id})`);
}

function nyTime(d = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

async function daemon(cfg: Config) {
  const { alpaca } = setup(cfg);
  const done = new Set<string>();
  console.log(`[${cfg.mode}] daemon started; slots ${cfg.schedule.join(", ")} ET`);
  for (;;) {
    try {
      const now = toMinutes(nyTime());
      // A slot fires once per day, any time in the 20 minutes after it (tolerates sleep/restarts).
      const due = cfg.schedule.find(
        (s) => now >= toMinutes(s) && now < toMinutes(s) + 20 && !done.has(`${nyDate()} ${s}`),
      );
      if (due) {
        done.add(`${nyDate()} ${due}`);
        if ((await alpaca.getClock()).isOpen) await runOnce(cfg);
        else console.log(`${due}: market closed, skipping`);
      }
    } catch (err) {
      console.error("cycle failed:", err);
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || !["run", "daemon", "status", "notes"].includes(cmd)) {
    console.log(USAGE);
    process.exit(cmd ? 1 : 0);
  }
  const cfg = loadConfig();
  if (cmd === "run") return runOnce(cfg);
  if (cmd === "daemon") return daemon(cfg);
  const { alpaca, journal } = setup(cfg);
  if (cmd === "notes") {
    for (const n of journal.recentNotes(50)) console.log(`[${n.at}] ${n.note}\n`);
    return;
  }
  const tools = new TradingTools(alpaca, cfg.limits, journal, "status");
  const r = await tools.run("get_portfolio", {});
  console.log(r.isError ? r.content : JSON.stringify(JSON.parse(r.content), null, 2));
}

main().catch((err) => {
  if (err instanceof ZodError) {
    console.error(
      `Config error (see .env.example):\n${err.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`,
    );
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exit(1);
});

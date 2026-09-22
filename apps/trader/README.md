# Trader

An autonomous Claude agent that trades an Alpaca account: US stocks/ETFs and
long options, a few times a day, with no human approval step. It starts on
**paper trading** (fake money) and only goes live if you explicitly switch it.

> This is an experiment, not financial advice. Aggressive strategies that aim
> for 100x returns usually lose most or all of the money. Run it on paper
> first, and only put in money you are fine losing entirely.

## How it works

```
cli (run | daemon)
  └─ agent.ts   Claude tool-use loop + a system prompt that states the goal and rules
       └─ tools.ts   portfolio, movers, snapshots, price history, option chains,
                     news, web search, place_order, cancel_order, save_note
            └─ risk.ts   checkOrder(): every order goes through this, no exceptions
                 └─ alpaca.ts   Alpaca REST (paper-api or api) + market data
journal.ts  .data/<mode>/events.jsonl (audit log) and notes.jsonl (agent memory)
```

The model can only _propose_ an order. `checkOrder` in `src/risk.ts` decides,
and the model can't change its limits:

| Limit                    | Default | Env                       |
| ------------------------ | ------- | ------------------------- |
| Max position size        | 40%     | `RISK_MAX_POSITION_PCT`   |
| Max open positions       | 4       | `RISK_MAX_OPEN_POSITIONS` |
| Max orders per day       | 4       | `RISK_MAX_ORDERS_PER_DAY` |
| No new buys below equity | $150    | `RISK_MIN_EQUITY_TO_OPEN` |
| Limit vs. quote band     | 5%      | `RISK_MAX_SLIPPAGE_PCT`   |
| Min option days-to-exp.  | 2       | `RISK_MIN_OPTION_DTE`     |
| Day trades per 5 days    | 3       | `RISK_MAX_DAY_TRADES`     |

The gate also enforces these rules: long only (no shorting, no writing
options), cash only (no margin), limit orders only, and regular market hours
only. A same-day sell is blocked when it would trigger the pattern-day-trader
rule, which applies while equity is under $25k.

## Setup

1. Create an [Alpaca](https://alpaca.markets) account, open the **Paper**
   account, and generate API keys. Options trading is on by default for paper
   accounts. For live, apply for options level 2 or higher.
2. Get a Claude API key from https://platform.claude.com.
3. Copy the example env and fill it in:

```bash
cp apps/trader/.env.example apps/trader/.env
pnpm --filter @kch/trader trade status   # check the keys work
pnpm --filter @kch/trader trade run      # one decision cycle now
pnpm --filter @kch/trader trade daemon   # runs at 09:45, 12:30, 15:30 ET on market days
pnpm --filter @kch/trader trade notes    # what the agent is planning
```

To set the paper balance to $1,000, reset the paper account in the Alpaca
dashboard and choose the starting amount.

`daemon` has to keep running, for example on a small VPS, an always-on
machine, or in `tmux`. The audit log and notes are stored in
`apps/trader/.data/`, which git ignores.

## Going live

```
TRADER_MODE=live
TRADER_CONFIRM_LIVE=yes
ALPACA_API_KEY_ID=<live key>
ALPACA_API_SECRET_KEY=<live secret>
```

Paper and live keep separate journals (`.data/paper`, `.data/live`).

## Cost

Each cycle is roughly 10–25 model calls with prompt caching. Three cycles a
day on Opus is typically a few dollars a day. On a $1,000 account that is a
real hurdle, so check the Claude Console usage page after the first week. To
lower it, set `TRADER_EFFORT=medium` or run fewer slots.

## Tests

```bash
pnpm --filter @kch/trader test
```

`risk.test.ts` covers every gate rule. `agent.test.ts` runs a full cycle
against a fake Alpaca and a scripted model: an oversized buy and a short sell
get rejected, a valid buy is submitted, and notes carry over to the next run.

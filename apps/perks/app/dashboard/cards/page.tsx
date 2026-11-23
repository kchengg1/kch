import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button, Card, CardDescription, CardTitle, Input, Label } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { CardIcon } from "@/components/card-icon";
import { CardsNav } from "@/components/dashboard-nav";
import { Meter } from "@/components/meter";
import { cardStyle } from "@/lib/card-style";
import { CATALOG } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { loadPortfolio, today as getToday } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { actionable, buildStatuses, summarizeCards } from "@/lib/summary";
import { breakEvenStatus } from "@/lib/worth";
import { addCardAction } from "../actions";

export const metadata: Metadata = { title: "Cards" };

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/** Computes whether a hex card finish is light enough to use dark ink on the metallic face. */
function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

export default async function CardsPage() {
  const { user } = await requireSession();
  const today = getToday();
  const { cards, benefits, usage } = await loadPortfolio(user.id);
  // How many credits each card has, and how many still need using this period.
  const todo = actionable(buildStatuses(cards, benefits, usage, today));
  const tracked = (cardId: string) =>
    benefits.filter((b) => b.cardId === cardId && b.cadence !== "perk" && b.tracked);
  /** "3 credits", "1 reminder" or "3 credits, 1 reminder": reminders have no dollar value. */
  const contents = (cardId: string) => {
    const credits = tracked(cardId).filter((b) => b.amountCents > 0).length;
    const reminders = tracked(cardId).length - credits;
    return [
      credits ? `${credits} credit${credits === 1 ? "" : "s"}` : "",
      reminders ? `${reminders} reminder${reminders === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  };
  const openCount = (cardId: string) => todo.filter((t) => t.card.id === cardId).length;
  const summaries = summarizeCards(cards, benefits, usage, today).sort(
    (a, b) =>
      b.card.annualFeeCents - a.card.annualFeeCents || a.card.name.localeCompare(b.card.name),
  );
  const totalFees = summaries.reduce((n, s) => n + s.card.annualFeeCents, 0);
  const closed = cards
    .filter((c) => c.closed)
    .sort((a, b) => (b.openedOn ?? "").localeCompare(a.openedOn ?? ""));

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <CardsNav />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cards</h1>
            <p className="text-sm text-muted-foreground">
              {summaries.length > 0
                ? `${summaries.length} active card${summaries.length === 1 ? "" : "s"} · ${formatCents(totalFees)} in annual fees · tap any card to manage credits.`
                : "Tap a card to see and tick off its credits."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/catch-up">
              <Button variant="outline" size="sm">
                Catch up on credits used
              </Button>
            </Link>
            <Link href="/dashboard/cards/import">
              <Button variant="outline" size="sm">
                Import cards
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {summaries.length > 0 && (
        <form action="/dashboard/pick" className="flex gap-2">
          <Input
            name="q"
            placeholder="Which card? Type a store, like Whole Foods"
            aria-label="Which card should I use? Type a store or category"
            className="h-11 bg-card"
          />
          <Button type="submit" className="h-11 px-5">
            Check
          </Button>
        </form>
      )}

      {/* Visual Card Wallet Grid */}
      {summaries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map((s) => {
            const finish = cardStyle(s.card.templateKey, s.card.issuer);
            const lightFace = isLightHex(finish.from);
            const dueCount = openCount(s.card.id);
            const contentSummary = contents(s.card.id);
            const be = breakEvenStatus(s.capturedCents, s.card.annualFeeCents, today);
            return (
              <Link
                key={s.card.id}
                href={`/dashboard/cards/${s.card.id}`}
                aria-label={`${s.card.name}: see credits and details`}
                className="group block overflow-hidden rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                {/* Metallic Card Face Header */}
                <div
                  className="sapphire-card-gloss relative px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, ${finish.from}, ${finish.to})`,
                    color: lightFace ? "#141a24" : "#f8fafc",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-5 w-7 rounded-[4px]"
                      style={{
                        background: finish.chip,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.22)",
                      }}
                    />
                    <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white backdrop-blur-xs">
                      {formatCents(s.card.annualFeeCents)}/yr
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-wider opacity-75">
                        {s.card.issuer || "Card"}
                        {s.card.business ? " · Business" : ""}
                      </p>
                      <p className="truncate text-base font-bold leading-snug">{s.card.name}</p>
                    </div>
                    {s.nextFeeOn && (
                      <span className="shrink-0 text-[11px] font-medium opacity-80">
                        Fee {formatDate(s.nextFeeOn, today)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Credit Capture Footer */}
                <div className="space-y-2.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    {s.availableCents > 0 ? (
                      <p className="text-sm">
                        <span className="font-bold tabular-nums">
                          {formatCents(s.capturedCents)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          of {formatCents(s.availableCents)} used
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {contentSummary || "No credits to track"}
                      </p>
                    )}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {be && (
                        <span
                          className={
                            be.state === "covered"
                              ? "rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-success"
                              : be.state === "on-pace"
                                ? "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
                                : "rounded-full bg-amber-500/14 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300"
                          }
                        >
                          {be.pct}%{" "}
                          {be.state === "covered"
                            ? "· Covered"
                            : be.state === "on-pace"
                              ? "· On pace"
                              : "· Behind"}
                        </span>
                      )}
                      <ChevronRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </div>
                  </div>

                  {s.availableCents > 0 && (
                    <Meter
                      value={s.capturedCents}
                      max={s.availableCents}
                      marker={s.card.annualFeeCents > 0 ? s.card.annualFeeCents : undefined}
                      markerLabel={
                        s.card.annualFeeCents > 0
                          ? `Annual fee break-even: ${formatCents(s.card.annualFeeCents)}`
                          : undefined
                      }
                      tone={s.capturedCents >= s.availableCents ? "success" : "primary"}
                    />
                  )}

                  {contentSummary && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-primary">{contentSummary}</span>
                      {dueCount > 0 ? (
                        <span className="rounded-full bg-amber-500/14 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-300">
                          {dueCount} to do this period
                        </span>
                      ) : (
                        <span className="rounded-full bg-success/12 px-2 py-0.5 font-semibold text-success">
                          Caught up
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Collapsible Add a Card panel (open automatically if no cards yet) */}
      <details
        open={summaries.length === 0}
        className="group max-w-2xl rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus aria-hidden className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base">Add a card</CardTitle>
              <CardDescription className="text-xs">
                Catalog cards come with their credits pre-filled.
              </CardDescription>
            </div>
          </div>
          <span className="text-xs font-medium text-primary group-open:hidden">Open form</span>
          <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">
            Hide
          </span>
        </summary>
        <div className="border-t px-6 pb-6 pt-4">
          <ActionForm action={addCardAction} submit="Add card" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template">Card</Label>
              <select id="template" name="template" className={select} defaultValue="">
                <option value="">Other card (name it below)</option>
                {CATALOG.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name (optional for listed cards)</Label>
                <Input id="name" name="name" placeholder="Citi Strata Premier" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issuer">Issuer</Label>
                <Input id="issuer" name="issuer" placeholder="Citibank" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="openedOn">Opened</Label>
                <Input id="openedOn" name="openedOn" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="annualFee">Annual fee, $ (optional for listed cards)</Label>
                <Input id="annualFee" name="annualFee" inputMode="decimal" placeholder="95" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="business" /> Business card
            </label>
          </ActionForm>
        </div>
      </details>

      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {closed.length} closed card{closed.length === 1 ? "" : "s"}, kept for bonus eligibility
          </summary>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {closed.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                  <Link
                    href={`/dashboard/cards/${c.id}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <CardIcon templateKey={c.templateKey} issuer={c.issuer} closed />
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {c.openedOn ? `Opened ${formatDate(c.openedOn, today)}` : "Closed"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </div>
  );
}

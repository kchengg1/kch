import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Card, CardDescription, CardTitle, Input, Label } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { CardIcon } from "@/components/card-icon";
import { Meter } from "@/components/meter";
import { CATALOG } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { loadPortfolio, today as getToday } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { actionable, buildStatuses, summarizeCards } from "@/lib/summary";
import { addCardAction } from "../actions";

export const metadata: Metadata = { title: "Cards" };

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

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
  const closed = cards
    .filter((c) => c.closed)
    .sort((a, b) => (b.openedOn ?? "").localeCompare(a.openedOn ?? ""));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cards</h1>
          <p className="text-sm text-muted-foreground">
            Tap a card to see and tick off its credits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/catch-up">
            <Button variant="outline">Catch up on credits used</Button>
          </Link>
          <Link href="/dashboard/cards/import">
            <Button variant="outline">Import cards</Button>
          </Link>
        </div>
      </div>

      {summaries.length > 0 && (
        <form action="/dashboard/pick" className="flex gap-2">
          <Input
            name="q"
            placeholder="Which card? Type a store, like Whole Foods"
            aria-label="Which card should I use? Type a store or category"
            className="h-11"
          />
          <Button type="submit" className="h-11">
            Check
          </Button>
        </form>
      )}

      {summaries.length > 0 && (
        <Card className="py-2">
          <ul className="divide-y">
            {summaries.map((s) => (
              <li key={s.card.id}>
                <Link
                  href={`/dashboard/cards/${s.card.id}`}
                  aria-label={`${s.card.name}: see credits and details`}
                  className="group -mx-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-[var(--radius)] px-3 py-4 hover:bg-muted/50 sm:grid-cols-[1fr_220px_auto]"
                >
                  <div className="flex items-center gap-3">
                    <CardIcon
                      templateKey={s.card.templateKey}
                      issuer={s.card.issuer}
                      className="h-6 w-10"
                    />
                    <div>
                      <p className="font-medium">{s.card.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCents(s.card.annualFeeCents)} fee
                        {s.nextFeeOn && ` · next due ${formatDate(s.nextFeeOn, today)}`}
                      </p>
                      {contents(s.card.id) && (
                        <p className="text-sm text-primary">
                          {contents(s.card.id)}
                          {openCount(s.card.id) > 0 &&
                            ` · ${openCount(s.card.id)} to do this period`}
                        </p>
                      )}
                    </div>
                  </div>
                  {s.availableCents > 0 ? (
                    <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                      <p className="text-sm">
                        <span className="font-semibold tabular-nums">
                          {formatCents(s.capturedCents)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          of {formatCents(s.availableCents)} used
                        </span>
                      </p>
                      <Meter value={s.capturedCents} max={s.availableCents} className="mt-1.5" />
                    </div>
                  ) : contents(s.card.id) ? (
                    <span className="hidden sm:block" />
                  ) : (
                    <p className="col-span-2 row-start-2 text-sm text-muted-foreground sm:col-span-1 sm:row-start-auto">
                      No credits to track
                    </p>
                  )}
                  <ChevronRight
                    aria-hidden
                    className="col-start-2 row-start-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:col-start-3"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardTitle>Add a card</CardTitle>
        <CardDescription className="mt-1">
          Cards on the list come with their credits filled in. Anything else starts blank.
        </CardDescription>
        <ActionForm action={addCardAction} submit="Add card" className="mt-4 space-y-4">
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
      </Card>

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
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {c.business && <Badge variant="secondary">Business</Badge>}
                    {c.openedOn ? `Opened ${formatDate(c.openedOn)}` : "Open date unknown"}
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

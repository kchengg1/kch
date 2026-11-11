import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, CardDescription, CardTitle, Input, Label } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { Meter } from "@/components/meter";
import { CATALOG } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { loadPortfolio, today as getToday } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { summarizeCards } from "@/lib/summary";
import { addCardAction } from "../actions";

export const metadata: Metadata = { title: "Cards" };

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export default async function CardsPage() {
  const { user } = await requireSession();
  const today = getToday();
  const { cards, benefits, usage } = await loadPortfolio(user.id);
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
        <h1 className="text-2xl font-bold">Cards</h1>
        <Link href="/dashboard/cards/import">
          <Button variant="outline">Import from spreadsheet</Button>
        </Link>
      </div>

      {summaries.length > 0 && (
        <Card className="py-2">
          <ul className="divide-y">
            {summaries.map((s) => (
              <li key={s.card.id}>
                <Link
                  href={`/dashboard/cards/${s.card.id}`}
                  className="grid items-center gap-x-6 gap-y-2 py-4 hover:bg-muted/40 sm:grid-cols-[1fr_220px]"
                >
                  <div>
                    <p className="font-medium">{s.card.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCents(s.card.annualFeeCents)} fee
                      {s.nextFeeOn && ` · next due ${formatDate(s.nextFeeOn, today)}`}
                    </p>
                  </div>
                  {s.availableCents > 0 ? (
                    <div>
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
                  ) : (
                    <p className="text-sm text-muted-foreground">No credits to track</p>
                  )}
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
                  <Link href={`/dashboard/cards/${c.id}`} className="hover:underline">
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

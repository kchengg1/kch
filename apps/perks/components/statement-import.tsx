"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Button, Label } from "@kch/ui";
import type { FormState } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/periods";
import { parseStatementCsv, suggestBenefit, type StatementParse } from "@/lib/statement-import";

const field =
  "w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

type CardOption = { id: string; name: string; benefits: { id: string; name: string }[] };

/** Upload a transactions CSV, confirm which benefit each credit is, then save. */
export function StatementImport({
  action,
  cards,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  cards: CardOption[];
}) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; parse: StatementParse } | null>(null);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [state, formAction, pending] = useActionState(action, undefined);
  const card = cards.find((c) => c.id === cardId);

  // A fresh suggestion per credit whenever the file or card changes; manual picks override it.
  const suggested = useMemo(
    () =>
      (file?.parse.credits ?? []).map((c) =>
        card ? (suggestBenefit(c.description, card.benefits)?.id ?? "") : "",
      ),
    [file, card],
  );
  const chosen = (i: number) => choices[i] ?? suggested[i] ?? "";
  const matched = (file?.parse.credits ?? [])
    .map((c, i) => ({ ...c, benefitId: chosen(i) }))
    .filter((c) => c.benefitId);

  async function onFile(f: File | undefined) {
    setChoices({});
    setFile(f ? { name: f.name, parse: parseStatementCsv(await f.text()) } : null);
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="stmt-card">Card</Label>
          <select
            id="stmt-card"
            name="cardId"
            value={cardId}
            onChange={(e) => {
              setCardId(e.target.value);
              setChoices({});
            }}
            className={`${field} h-10`}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stmt-file">Transactions file (.csv)</Label>
          <input
            id="stmt-file"
            type="file"
            accept=".csv,.txt,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:bg-card file:px-3 file:py-2 file:text-sm"
          />
        </div>
      </div>
      <input type="hidden" name="credits" value={JSON.stringify(matched)} />

      {file?.parse.error && <Alert variant="error">{file.parse.error}</Alert>}
      {file && !file.parse.error && file.parse.credits.length === 0 && (
        <Alert>
          {file.parse.charges} purchases read from {file.name}, but no credits. Check the file
          covers the months you expect.
        </Alert>
      )}
      {file && file.parse.credits.length > 0 && (
        <div className="rounded-[var(--radius)] border bg-card">
          <p className="border-b px-4 py-2.5 text-sm">
            <span className="font-medium">
              {file.parse.credits.length} credits found, {matched.length} matched to a benefit.
            </span>{" "}
            <span className="text-muted-foreground">
              Refunds from merchants can stay on &ldquo;Not a card benefit&rdquo;.
            </span>
          </p>
          <ul className="divide-y text-sm">
            {file.parse.credits.map((c, i) => (
              <li
                key={i}
                className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[90px_1fr_80px_240px]"
              >
                <span className="text-muted-foreground">{formatDate(c.date)}</span>
                <span className="min-w-0 truncate" title={c.description}>
                  {c.description}
                </span>
                <span className="tabular-nums sm:text-right">{formatCents(c.amountCents)}</span>
                <select
                  aria-label={`Benefit for ${c.description} on ${c.date}`}
                  value={chosen(i)}
                  onChange={(e) => setChoices({ ...choices, [i]: e.target.value })}
                  className={`${field} h-8`}
                >
                  <option value="">Not a card benefit</option>
                  {card?.benefits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" disabled={pending || matched.length === 0}>
        {pending
          ? "Saving…"
          : `Save ${matched.length} matched credit${matched.length === 1 ? "" : "s"}`}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Badge, Button, Label } from "@kch/ui";
import type { FormState } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { parseOffers } from "@/lib/offer-parse";
import { formatDate } from "@/lib/periods";

const field =
  "w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/** Paste an offers page, check what was read from it, then save. */
export function OfferPaste({
  action,
  cards,
  today,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  cards: { id: string; name: string }[];
  today: string;
}) {
  const [text, setText] = useState("");
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await action(prev, form);
    if (result?.message) {
      setText("");
      setRemoved(new Set());
    }
    return result;
  }, undefined);
  const parsed = useMemo(() => parseOffers(text, today), [text, today]);
  const kept = parsed.filter((_, i) => !removed.has(i));

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cardId">Card these offers are on</Label>
        <select
          id="cardId"
          name="cardId"
          className={`${field} h-10`}
          defaultValue={cards[0]?.id ?? ""}
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="">No specific card</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paste">Pasted offers page</Label>
        <textarea
          id="paste"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRemoved(new Set());
          }}
          rows={7}
          placeholder={"lululemon\nSpend $150 or more, get $30 back\nExpires 12/15/2026"}
          className={`${field} py-2 font-mono text-xs`}
        />
      </div>
      <input type="hidden" name="offers" value={JSON.stringify(kept)} />

      {text.trim() && parsed.length === 0 && (
        <Alert variant="error">
          No offers recognised yet. Each offer needs a merchant line and a deal line such as
          &ldquo;Spend $80 or more, get $15 back&rdquo;.
        </Alert>
      )}
      {parsed.length > 0 && (
        <div className="rounded-[var(--radius)] border bg-card">
          <p className="border-b px-4 py-2.5 text-sm font-medium">
            {kept.length} offer{kept.length === 1 ? "" : "s"} found. Remove any that look wrong.
          </p>
          <ul className="divide-y text-sm">
            {parsed.map((o, i) =>
              removed.has(i) ? null : (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {o.merchant} {o.added && <Badge variant="success">Added</Badge>}
                    </p>
                    <p className="text-muted-foreground">
                      {o.details}
                      {o.valueCents !== null && ` · up to ${formatCents(o.valueCents)}`}
                      {` · ${o.expiresOn ? `expires ${formatDate(o.expiresOn, today)}` : "no expiry found"}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoved(new Set(removed).add(i))}
                    aria-label={`Remove ${o.merchant}`}
                  >
                    Remove
                  </Button>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" disabled={pending || kept.length === 0}>
        {pending
          ? "Saving…"
          : kept.length
            ? `Save ${kept.length} offer${kept.length === 1 ? "" : "s"}`
            : "Save offers"}
      </Button>
    </form>
  );
}

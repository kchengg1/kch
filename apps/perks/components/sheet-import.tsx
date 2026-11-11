"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Badge, Button } from "@kch/ui";
import type { FormState } from "@/app/dashboard/actions";
import { getTemplate } from "@/lib/catalog";
import { parseCardSheet } from "@/lib/sheet-import";

/** Paste box with a live preview of the cards that will be imported. */
export function SheetImport({
  action,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(action, undefined);
  const parsed = useMemo(() => (text.trim() ? parseCardSheet(text) : null), [text]);
  const open = parsed?.cards.filter((c) => !c.closed) ?? [];
  const closedCount = (parsed?.cards.length ?? 0) - open.length;

  return (
    <form action={formAction} className="space-y-4">
      <textarea
        name="sheet"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        required
        aria-label="Spreadsheet rows"
        placeholder={"Card Name\tApproval Date\t…\nChase Sapphire Reserve\t3/1/2025\t…"}
        className="w-full rounded-[var(--radius)] border bg-card p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      />
      {parsed?.error && <Alert variant="error">{parsed.error}</Alert>}
      {parsed && !parsed.error && (
        <div className="rounded-[var(--radius)] border bg-card">
          <p className="border-b px-4 py-2.5 text-sm font-medium">
            {open.length} open card{open.length === 1 ? "" : "s"}
            {closedCount > 0 && `, plus ${closedCount} closed kept for bonus eligibility`}
          </p>
          <ul className="divide-y text-sm">
            {open.map((c, i) => {
              const template = getTemplate(c.templateKey);
              const credits = template?.benefits.filter((b) => b.cadence !== "perk").length ?? 0;
              return (
                <li
                  key={`${c.name}-${i}`}
                  className="flex items-center justify-between gap-4 px-4 py-2"
                >
                  <span>{c.name}</span>
                  {template ? (
                    <Badge variant="success">
                      {template.name} · {credits} credit{credits === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No template</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" disabled={pending || !parsed || Boolean(parsed.error)}>
        {pending
          ? "Importing…"
          : parsed?.cards.length
            ? `Import ${parsed.cards.length} cards`
            : "Import"}
      </Button>
    </form>
  );
}

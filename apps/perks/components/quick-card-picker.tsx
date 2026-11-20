"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Card } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { CATEGORIES, classify, rankCards } from "@/lib/earn";
import { defaultCentsPerPoint } from "@/lib/points";

type PickerCard = {
  id: string;
  name: string;
  templateKey: string | null;
  issuer: string;
  closed: boolean;
};

const QUICK_EXAMPLES = ["Whole Foods", "Dining", "Flights", "Hotels"] as const;

/**
 * Instant client-side "Which card?" lookup for the Overview rail, with ⌘K / Ctrl+K focus.
 * Runs purely client-side without submitting a form so it stays fast and non-intrusive.
 */
export function QuickCardPicker({
  cards,
  pointValues,
}: {
  cards: PickerCard[];
  pointValues: Record<string, number>;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmed = query.trim();
  const target = useMemo(() => (trimmed ? classify(trimmed) : null), [trimmed]);
  const categoryLabel = target
    ? (CATEGORIES.find((c) => c.id === target.category)?.label ?? "Everything else")
    : "";
  const picks = useMemo(() => {
    if (!target) return [];
    const valueOf = (program: string) => pointValues[program] ?? defaultCentsPerPoint(program);
    return rankCards(cards, target, valueOf).slice(0, 3);
  }, [cards, pointValues, target]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Which card should I use?</h2>
        <kbd className="hidden rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </div>
      <div className="relative mt-2.5">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Store or category, e.g. Whole Foods"
          aria-label="Quick card lookup by store or category"
          className="flex h-9 w-full rounded-[var(--radius)] border bg-background/70 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
      </div>

      {!trimmed ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              className="rounded-full border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      ) : picks.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No catalog cards found to rank for {categoryLabel.toLowerCase()}.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Best for <span className="font-medium text-foreground">{categoryLabel}</span>
          </p>
          <ul className="space-y-1.5">
            {picks.map((p, idx) => (
              <li
                key={p.cardId}
                className={
                  idx === 0
                    ? "flex items-center justify-between gap-2 rounded-[var(--radius)] border border-primary/25 bg-primary/8 px-2.5 py-2"
                    : "flex items-center justify-between gap-2 rounded-[var(--radius)] px-2.5 py-1.5 hover:bg-muted/50"
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <CardIcon
                    templateKey={p.templateKey}
                    issuer={p.issuer}
                    className="h-4 w-6 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{p.cardName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {Number(p.x.toFixed(1))}x {p.currency === "Cash back" ? "cash" : p.currency}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-success">
                  {p.returnPct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={`/dashboard/pick?q=${encodeURIComponent(trimmed)}` as never}
            className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline"
          >
            Full breakdown &amp; offers
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </Card>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge, Card } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/periods";

export type AnnualFeeItem = {
  cardId: string;
  cardName: string;
  templateKey: string | null;
  issuer: string;
  annualFeeCents: number;
  nextFeeOn: string | null;
  daysUntilFee: number | null;
  worthCents: number;
  netCents: number;
};

export function AnnualFeesCard({
  items,
  today,
  initialCount,
}: {
  items: AnnualFeeItem[];
  today: string;
  initialCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, initialCount);
  const hiddenCount = Math.max(0, items.length - initialCount);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Annual fees coming up</h2>
        {items.length > 1 && (
          <span className="text-xs tabular-nums text-muted-foreground">{items.length} cards</span>
        )}
      </div>
      <ul className="mt-3 divide-y">
        {visible.map((item) => (
          <li key={item.cardId} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/dashboard/cards/${item.cardId}`}
                className="inline-flex min-w-0 items-center gap-2 text-sm font-medium hover:underline"
              >
                <CardIcon templateKey={item.templateKey} issuer={item.issuer} className="h-4 w-6" />
                <span className="truncate">{item.cardName}</span>
              </Link>
              <Badge variant={item.netCents >= 0 ? "success" : "secondary"}>
                {item.netCents >= 0 ? "Keep" : "Review"}
              </Badge>
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">
              {item.nextFeeOn
                ? `${formatCents(item.annualFeeCents)} around ${formatDate(item.nextFeeOn, today)}`
                : `${formatCents(item.annualFeeCents)}/yr · Add opened date`}{" "}
              · worth {formatCents(item.worthCents)}/yr
            </p>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1 border-t pt-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp aria-hidden className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show {hiddenCount} more
              <ChevronDown aria-hidden className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </Card>
  );
}

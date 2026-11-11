import Link from "next/link";
import { Badge, Button, Input } from "@kch/ui";
import { logAmountAction, markUsedAction } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/periods";
import type { BenefitStatus } from "@/lib/summary";

export function dueLabel(days: number): string {
  if (days <= 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/** One unused credit with the controls to tick it off or log part of it. */
export function CreditRow({ status, today }: { status: BenefitStatus; today: string }) {
  const { benefit, card, period, remainingCents, usedCents, daysLeft, deadline } = status;
  if (!period || daysLeft === null || !deadline) return null;
  const urgent = daysLeft <= 7;
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {benefit.amountCents > 0 && (
            <span className="font-semibold tabular-nums">{formatCents(remainingCents)}</span>
          )}
          <span className="font-medium">{benefit.name}</span>
          {benefit.enrollRequired && !benefit.enrolled && (
            <Badge variant="outline">Enroll first</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <Link href={`/dashboard/cards/${card.id}`} className="hover:underline">
            {card.name}
          </Link>
          {" · "}
          <span className={urgent ? "font-medium text-destructive" : undefined}>
            {dueLabel(daysLeft)}
          </span>
          {` · ends ${formatDate(deadline, today)}`}
          {usedCents > 0 && ` · ${formatCents(usedCents)} used`}
        </p>
        {benefit.notes && <p className="mt-1 text-sm text-muted-foreground">{benefit.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {benefit.amountCents > 0 && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-[var(--radius)] px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              Partial
            </summary>
            <form
              action={logAmountAction.bind(null, benefit.id, period.key)}
              className="absolute right-0 z-10 mt-1 flex w-56 items-center gap-2 rounded-[var(--radius)] border bg-card p-2 shadow-md"
            >
              <Input
                name="amount"
                inputMode="decimal"
                placeholder="Total used, $"
                aria-label={`Total used of ${benefit.name}`}
                className="h-8"
                required
              />
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
            </form>
          </details>
        )}
        <form action={markUsedAction.bind(null, benefit.id, period.key)}>
          <Button type="submit" size="sm">
            {benefit.amountCents > 0 ? "Mark used" : "Done"}
          </Button>
        </form>
      </div>
    </li>
  );
}

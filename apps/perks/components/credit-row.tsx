import Link from "next/link";
import { CardIcon } from "@/components/card-icon";
import { Badge, Button, Input, cn } from "@kch/ui";
import { logAmountAction, markUsedAction } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/periods";
import type { BenefitStatus } from "@/lib/summary";

export function dueLabel(days: number): string {
  if (days <= 0) return "Ends today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/** One unused credit with urgency edge, amount badge, and controls to tick it off or log part of it. */
export function CreditRow({ status, today }: { status: BenefitStatus; today: string }) {
  const { benefit, card, period, remainingCents, usedCents, daysLeft, deadline } = status;
  if (!period || daysLeft === null || !deadline) return null;
  const urgent = daysLeft <= 7;
  const soon = !urgent && daysLeft <= 31;

  return (
    <li
      className={cn(
        "relative flex flex-col gap-3 py-4 pl-3.5 sm:flex-row sm:items-center sm:justify-between",
        "before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-full",
        urgent
          ? "before:bg-destructive"
          : soon
            ? "before:bg-amber-500 dark:before:bg-amber-400"
            : "before:bg-border",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {benefit.amountCents > 0 && (
          <span
            className={cn(
              "mt-0.5 inline-flex min-w-[56px] shrink-0 items-center justify-center rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
              urgent ? "bg-destructive/12 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            {formatCents(remainingCents)}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">{benefit.name}</span>
            {benefit.enrollRequired && !benefit.enrolled && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              >
                Enroll first
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <Link
              href={`/dashboard/cards/${card.id}`}
              className="inline-flex items-center gap-1.5 align-middle hover:text-foreground hover:underline"
            >
              <CardIcon
                templateKey={card.templateKey}
                issuer={card.issuer}
                className="h-3.5 w-[22px]"
              />
              {card.name}
            </Link>
            {" · "}
            <span
              className={cn(
                urgent
                  ? "font-semibold text-destructive"
                  : soon
                    ? "font-medium text-amber-700 dark:text-amber-300"
                    : undefined,
              )}
            >
              {dueLabel(daysLeft)}
            </span>
            {` · ends ${formatDate(deadline, today)}`}
            {usedCents > 0 && ` · ${formatCents(usedCents)} used`}
          </p>
          {benefit.notes && <p className="mt-1 text-xs text-muted-foreground">{benefit.notes}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-[68px] sm:pl-0">
        {benefit.amountCents > 0 && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-[var(--radius)] border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Partial
            </summary>
            <form
              action={logAmountAction.bind(null, benefit.id, period.key)}
              className="absolute right-0 z-20 mt-1.5 flex w-56 items-center gap-2 rounded-[var(--radius)] border bg-card p-2 shadow-lg"
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

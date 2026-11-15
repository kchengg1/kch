import { Button, cn } from "@kch/ui";
import { clearUsedAction, markPastUsedAction, markUsedAction } from "@/app/dashboard/actions";
import { formatCents } from "@/lib/money";
import { periodsThisYear, shortLabel, type Cadence } from "@/lib/periods";
import { usedIn } from "@/lib/summary";

/**
 * One chip per period of the year for a credit: tap to mark used, tap again
 * to undo. Adds a one-tap "mark every earlier period used" when any are open.
 */
export function UsageChips({
  benefitId,
  amountCents,
  cadence,
  openedOn,
  usage,
  today,
}: {
  benefitId: string;
  amountCents: number;
  cadence: Cadence;
  openedOn: string | null;
  usage: Map<string, number>;
  today: string;
}) {
  const periods = periodsThisYear(cadence, today, openedOn);
  const openPast = periods.filter(
    (p) => p.end < today && usedIn(usage, benefitId, p.key) === undefined,
  );
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {periods.map((p) => {
        const logged = usedIn(usage, benefitId, p.key);
        const full = logged !== undefined && logged >= amountCents;
        const partial = !full && (logged ?? 0) > 0;
        const action = (full || partial ? clearUsedAction : markUsedAction).bind(
          null,
          benefitId,
          p.key,
        );
        return (
          <form key={p.key} action={action}>
            <button
              type="submit"
              disabled={p.start > today}
              aria-pressed={full}
              title={
                full
                  ? `${p.label}: used`
                  : partial
                    ? `${p.label}: ${formatCents(logged!)} used`
                    : `${p.label}: not used`
              }
              className={cn(
                "min-h-9 min-w-12 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 sm:min-h-0",
                full && "border-transparent bg-success text-white",
                partial && "border-success bg-success/15",
                !full && !partial && "bg-card hover:bg-muted",
                p.start <= today && p.end >= today && "ring-2 ring-primary/40",
              )}
            >
              {full ? "✓ " : ""}
              {shortLabel(cadence, p)}
              {partial ? ` · ${formatCents(logged!)}` : ""}
            </button>
          </form>
        );
      })}
      {openPast.length > 1 && (
        <form action={markPastUsedAction.bind(null, benefitId)}>
          <Button type="submit" size="sm" variant="link" className="h-auto px-2 py-1 text-xs">
            Mark {openPast.length} earlier {openPast.length === 1 ? "period" : "periods"} used
          </Button>
        </form>
      )}
    </div>
  );
}

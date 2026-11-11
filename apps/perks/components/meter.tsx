import { cn } from "@kch/ui";

/** Thin progress bar. `value` and `max` share a unit; the fill is capped at 100%. */
export function Meter({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
    </div>
  );
}

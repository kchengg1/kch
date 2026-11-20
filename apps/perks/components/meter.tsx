import { cn } from "@kch/ui";

/** Progress bar. `value` and `max` share a unit; the fill is capped at 100%. */
export function Meter({
  value,
  max,
  tone = "success",
  className,
}: {
  value: number;
  max: number;
  tone?: "success" | "primary" | "accent";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fill =
    tone === "primary"
      ? "bg-primary"
      : tone === "accent"
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-success";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

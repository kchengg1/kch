import { cn } from "@kch/ui";

/** Progress bar. `value`, `max`, and optional `marker` share a unit; the fill is capped at 100%. */
export function Meter({
  value,
  max,
  marker,
  markerLabel,
  tone = "success",
  className,
}: {
  value: number;
  max: number;
  /** Optional threshold position (e.g. annual fee in cents) drawn as a tick on the bar. */
  marker?: number;
  markerLabel?: string;
  tone?: "success" | "primary" | "accent";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const markerPct =
    marker !== undefined && marker > 0 && max > 0 && marker <= max
      ? Math.min(99, Math.max(1, Math.round((marker / max) * 100)))
      : null;
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
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all", fill)}
        style={{ width: `${pct}%` }}
      />
      {markerPct !== null && (
        <span
          aria-hidden={!markerLabel}
          title={markerLabel}
          className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-foreground/55"
          style={{ left: `${markerPct}%` }}
        />
      )}
    </div>
  );
}

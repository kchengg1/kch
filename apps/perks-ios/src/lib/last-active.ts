const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human-friendly "last active" label, e.g. "Just now", "3 hours ago", "Nov 2, 2026". */
export function formatLastActive(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Not recorded yet";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "Not recorded yet";
  const diff = now.getTime() - at.getTime();
  if (diff < 5 * MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} minutes ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 30 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  }
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

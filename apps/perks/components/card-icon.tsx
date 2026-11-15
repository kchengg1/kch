import { cn } from "@kch/ui";
import { cardStyle } from "@/lib/card-style";

/** A small card-shaped swatch in the card's colours, shown beside its name. */
export function CardIcon({
  templateKey,
  issuer,
  closed,
  className,
}: {
  templateKey?: string | null;
  issuer?: string | null;
  closed?: boolean;
  className?: string;
}) {
  const s = cardStyle(templateKey, issuer);
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-block h-5 w-8 shrink-0 overflow-hidden rounded-[4px] align-middle shadow-sm ring-1 ring-black/10",
        closed && "opacity-40 grayscale",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
    >
      <span
        className="absolute top-[30%] left-[12%] h-[30%] w-[26%] rounded-[1.5px]"
        style={{ background: s.chip, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,.25)" }}
      />
    </span>
  );
}

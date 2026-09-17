import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Alert({
  className,
  variant = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "info" | "error" | "success" }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius)] border px-4 py-3 text-sm",
        variant === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "success" && "border-success/40 bg-success/10",
        variant === "info" && "bg-muted",
        className,
      )}
      {...props}
    />
  );
}

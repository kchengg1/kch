"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input, Label, cn } from "@kch/ui";
import type { FormState } from "@/app/dashboard/actions";
import { formatCents, parseDollars } from "@/lib/money";
import { checkRedemption, formatCpp } from "@/lib/points";

const field =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/**
 * Points or cash? Enter an award and its cash price; the answer compares the
 * cents per point it gets against your own value for that program.
 */
export function RedemptionCalc({
  programs,
  action,
}: {
  /** Programs with the owner's value, in cents per point. */
  programs: { program: string; centsPerPoint: number }[];
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [program, setProgram] = useState(programs[0]?.program ?? "");
  const [cash, setCash] = useState("");
  const [points, setPoints] = useState("");
  const [fees, setFees] = useState("");
  const [state, formAction, pending] = useActionState(action, undefined);
  const value = programs.find((p) => p.program === program)?.centsPerPoint ?? 1;
  const result = checkRedemption({
    cashCents: parseDollars(cash) ?? 0,
    points: Math.round(Number(points.replace(/[,\s]/g, "")) || 0),
    feesCents: parseDollars(fees || "0") ?? 0,
    valueCentsPerPoint: value,
  });

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="calc-program">Program</Label>
          <select
            id="calc-program"
            name="program"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            className={field}
          >
            {programs.map((p) => (
              <option key={p.program} value={p.program}>
                {p.program} (you value at {formatCpp(p.centsPerPoint)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-cash">Cash price, $</Label>
          <Input
            id="calc-cash"
            name="cash"
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="2300"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-points">Points needed</Label>
          <Input
            id="calc-points"
            name="points"
            inputMode="numeric"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="318000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-fees">Taxes and fees on the award, $</Label>
          <Input
            id="calc-fees"
            name="fees"
            inputMode="decimal"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="calc-note">Note (optional)</Label>
          <Input id="calc-note" name="note" placeholder="Hotel in Lisbon, 3 nights" />
        </div>
      </div>

      {result && (
        <div
          role="status"
          className={cn(
            "rounded-[var(--radius)] border px-4 py-3",
            result.verdict === "points" && "border-success/40 bg-success/10",
            result.verdict === "cash" && "border-destructive/40 bg-destructive/10",
            result.verdict === "even" && "bg-muted",
          )}
        >
          <p className="font-semibold">
            {result.verdict === "points"
              ? "Use points"
              : result.verdict === "cash"
                ? "Pay cash"
                : "About even"}
            : {formatCpp(result.centsPerPoint)} per point
          </p>
          <p className="text-sm text-muted-foreground">
            You value {program} at {formatCpp(value)}.{" "}
            {result.verdict === "even"
              ? "Either way works."
              : result.gainCents > 0
                ? `Booking with points comes out ${formatCents(result.gainCents)} ahead.`
                : `Paying cash and keeping the points comes out ${formatCents(-result.gainCents)} ahead.`}
          </p>
        </div>
      )}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" variant="outline" disabled={pending || !result}>
        Log as a redemption I made
      </Button>
    </form>
  );
}

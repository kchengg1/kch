import type { Metadata } from "next";
import { Button, Card, CardDescription, CardTitle, Input } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { PointsBalanceForm } from "@/components/points-balance-form";
import { RedemptionCalc } from "@/components/redemption-calc";
import { formatCents } from "@/lib/money";
import { listPoints, listRedemptions } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import {
  PROGRAMS,
  VALUATION_SOURCE,
  balanceValueCents,
  checkRedemption,
  defaultCentsPerPoint,
  defaultCentsPerPointX100,
  effectiveCentsPerPointX100,
  formatCpp,
} from "@/lib/points";
import { requireSession } from "@/lib/session";
import {
  addRedemptionAction,
  deletePointsAction,
  deleteRedemptionAction,
  importBalancesAction,
  resetPointsValueAction,
  savePointsAction,
} from "../actions";

export const metadata: Metadata = { title: "Points" };

const PROGRAM_COLORS = [
  "#1e3a8a",
  "#0d9488",
  "#d97706",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#64748b",
] as const;

export default async function PointsPage() {
  const { user } = await requireSession();
  const [points, redemptions] = await Promise.all([listPoints(user.id), listRedemptions(user.id)]);
  const rows = points
    // Estimates, so shown to the dollar.
    .map((p) => {
      const effectiveCppX100 = effectiveCentsPerPointX100(p);
      const defaultCppX100 = defaultCentsPerPointX100(p.program);
      return {
        ...p,
        effectiveCppX100,
        defaultCppX100,
        valueCents: Math.round(balanceValueCents(p.balance, effectiveCppX100) / 100) * 100,
      };
    })
    .sort((a, b) => b.valueCents - a.valueCents);
  const total = rows.reduce((n, r) => n + r.valueCents, 0);
  const totalPoints = rows.reduce((n, r) => n + r.balance, 0);
  const valueOf = new Map(rows.map((p) => [p.program, p.effectiveCppX100 / 100]));
  const calcPrograms = [
    ...rows.map((r) => ({ program: r.program, centsPerPoint: r.effectiveCppX100 / 100 })),
    ...PROGRAMS.filter((p) => !valueOf.has(p)).map((p) => ({
      program: p,
      centsPerPoint: defaultCentsPerPoint(p),
    })),
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Points</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length === 0 ? (
            <>
              Add your points and miles to see what they are worth using{" "}
              <a
                href={VALUATION_SOURCE.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {VALUATION_SOURCE.label}
              </a>
              .
            </>
          ) : (
            <>
              {totalPoints.toLocaleString("en-US")} points and miles across {rows.length} program
              {rows.length === 1 ? "" : "s"}, worth about {formatCents(total)} (based on{" "}
              <a
                href={VALUATION_SOURCE.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {VALUATION_SOURCE.label}
              </a>
              ).
            </>
          )}
        </p>
      </div>

      {rows.length > 0 && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated portfolio value
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                {formatCents(total)}
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums text-muted-foreground">
              {totalPoints.toLocaleString("en-US")} total pts
            </p>
          </div>
          {total > 0 && (
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted gap-0.5">
              {rows.map((r, idx) => {
                const pct = (r.valueCents / total) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={r.id}
                    title={`${r.program}: ${formatCents(r.valueCents)} (${Math.round(pct)}%)`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: PROGRAM_COLORS[idx % PROGRAM_COLORS.length],
                    }}
                  />
                );
              })}
            </div>
          )}
          <ul className="divide-y pt-1">
            {rows.map((r, idx) => (
              <li key={r.id} className="py-3 first:pt-1 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PROGRAM_COLORS[idx % PROGRAM_COLORS.length] }}
                    />
                    <span className="truncate">{r.program}</span>
                  </p>
                  <p className="shrink-0 font-semibold tabular-nums">{formatCents(r.valueCents)}</p>
                </div>
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm text-muted-foreground">
                    {r.balance.toLocaleString("en-US")} at {formatCpp(r.effectiveCppX100 / 100)}
                    {r.customValue ? " (custom)" : ""} ·{" "}
                    <span className="underline-offset-2 group-hover:underline">Edit</span>
                  </summary>
                  <ActionForm
                    action={savePointsAction}
                    submit="Save"
                    size="sm"
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="program" value={r.program} />
                    <label className="text-xs text-muted-foreground">
                      Balance
                      <Input
                        name="balance"
                        inputMode="numeric"
                        defaultValue={String(r.balance)}
                        className="mt-1 h-9 w-32"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      ¢ per point
                      <Input
                        name="cpp"
                        inputMode="decimal"
                        defaultValue={String(r.effectiveCppX100 / 100)}
                        placeholder={String(r.defaultCppX100 / 100)}
                        className="mt-1 h-9 w-24"
                      />
                    </label>
                  </ActionForm>
                  <div className="mt-1 flex flex-wrap items-center gap-4">
                    {r.customValue && (
                      <form action={resetPointsValueAction.bind(null, r.id)}>
                        <Button type="submit" size="sm" variant="link" className="px-0">
                          Reset to auto ({formatCpp(r.defaultCppX100 / 100)})
                        </Button>
                      </form>
                    )}
                    <form action={deletePointsAction.bind(null, r.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="link"
                        className="px-0 text-destructive"
                      >
                        Remove {r.program}
                      </Button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Add or update a balance</CardTitle>
          <CardDescription className="mt-1">
            Point values auto-fill from {VALUATION_SOURCE.label} and update automatically unless you
            enter a custom value.
          </CardDescription>
          <PointsBalanceForm
            action={savePointsAction}
            existing={rows.map((r) => ({
              program: r.program,
              centsPerPoint: r.effectiveCppX100 / 100,
              customValue: r.customValue,
            }))}
          />
        </Card>

        <Card>
          <CardTitle>Paste several balances</CardTitle>
          <CardDescription className="mt-1">
            One program per line, like &ldquo;Amex MR, 270520&rdquo;. The Point/Mile Balances block
            of your Players &amp; Totals tab pastes straight in.
          </CardDescription>
          <ActionForm
            action={importBalancesAction}
            submit="Update balances"
            className="mt-4 space-y-4"
          >
            <textarea
              name="balances"
              rows={5}
              aria-label="Balances, one per line"
              placeholder={
                "Alaska Mileage Plan\t55000\nAmerican Express Membership Rewards\t270520"
              }
              className="w-full rounded-[var(--radius)] border bg-card p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              required
            />
          </ActionForm>
        </Card>
      </div>

      <Card className="max-w-3xl">
        <CardTitle>Points or cash?</CardTitle>
        <CardDescription className="mt-1">
          Enter an award and what the same booking costs in cash. Cents per point is the cash price
          minus the award&rsquo;s taxes and fees, divided by the points.
        </CardDescription>
        <div className="mt-4">
          <RedemptionCalc programs={calcPrograms} action={addRedemptionAction} />
        </div>
      </Card>

      {redemptions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Redemptions you made</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {[...redemptions].reverse().map((r) => {
                const cpp = (r.cashCents - r.feesCents) / r.points;
                const mine = valueOf.get(r.program) ?? defaultCentsPerPoint(r.program);
                const check = checkRedemption({
                  cashCents: r.cashCents,
                  points: r.points,
                  feesCents: r.feesCents,
                  valueCentsPerPoint: mine,
                });
                return (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {formatCpp(cpp)} per point{" "}
                        <span className="font-normal text-muted-foreground">
                          ·{" "}
                          {check?.verdict === "cash"
                            ? "below"
                            : check?.verdict === "points"
                              ? "above"
                              : "at"}{" "}
                          your {formatCpp(mine)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {r.points.toLocaleString("en-US")} {r.program} for a{" "}
                        {formatCents(r.cashCents)} booking
                        {r.feesCents ? ` + ${formatCents(r.feesCents)} fees` : ""} ·{" "}
                        {formatDate(r.redeemedOn)}
                        {r.note && ` · ${r.note}`}
                      </p>
                    </div>
                    <form action={deleteRedemptionAction.bind(null, r.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

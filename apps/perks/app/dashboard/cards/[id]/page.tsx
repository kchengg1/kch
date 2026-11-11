import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardDescription, CardTitle, Input, Label, cn } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { BenefitFields } from "@/components/benefit-fields";
import { Meter } from "@/components/meter";
import { CATALOG, CATALOG_REVIEWED, getTemplate } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { getCard, loadPortfolio, today as getToday } from "@/lib/perks";
import {
  CADENCE_LABEL,
  formatDate,
  isCadence,
  periodsThisYear,
  shortLabel,
  type Cadence,
} from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { indexUsage, summarizeCards, usedIn } from "@/lib/summary";
import {
  addBenefitAction,
  applyTemplateAction,
  clearUsedAction,
  deleteBenefitAction,
  deleteCardAction,
  markUsedAction,
  setBenefitFlagAction,
  updateBenefitAction,
  updateCardAction,
} from "../../actions";

const select =
  "flex h-10 w-full rounded-[var(--radius)] border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireSession();
  const card = await getCard(id, user.id);
  if (!card) notFound();

  const today = getToday();
  const portfolio = await loadPortfolio(user.id);
  const benefits = portfolio.benefits.filter((b) => b.cardId === card.id);
  const usage = indexUsage(portfolio.usage);
  const [summary] = summarizeCards([card], benefits, portfolio.usage, today);
  const template = getTemplate(card.templateKey);
  const credits = benefits.filter((b) => b.cadence !== "perk");
  const perks = benefits.filter((b) => b.cadence === "perk");

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/cards"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Cards
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{card.name}</h1>
          {card.business && <Badge variant="secondary">Business</Badge>}
          {card.closed && <Badge variant="outline">Closed</Badge>}
        </div>
        <p className="mt-1 text-muted-foreground">
          {[
            card.issuer,
            `${formatCents(card.annualFeeCents)} annual fee`,
            card.openedOn && `opened ${formatDate(card.openedOn)}`,
            summary?.nextFeeOn && `next fee ${formatDate(summary.nextFeeOn, today)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {summary && summary.availableCents > 0 && (
        <Card className="max-w-xl">
          <p className="text-sm text-muted-foreground">Credits used in {today.slice(0, 4)}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
            {formatCents(summary.capturedCents)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              of {formatCents(summary.availableCents)} tracked
            </span>
          </p>
          <Meter value={summary.capturedCents} max={summary.availableCents} className="mt-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            {summary.capturedCents >= card.annualFeeCents
              ? `That covers the ${formatCents(card.annualFeeCents)} fee.`
              : `${formatCents(card.annualFeeCents - summary.capturedCents)} more to cover the fee.`}
          </p>
        </Card>
      )}

      {!card.closed && (
        <section>
          <h2 className="text-lg font-semibold">Credits</h2>
          <p className="text-sm text-muted-foreground">
            Tap a period to mark the credit used, tap again to undo. Switch off anything you do not
            plan to chase so it stops counting against you.
            {template &&
              ` Template last checked ${formatDate(CATALOG_REVIEWED)}; edit anything that has changed.`}
          </p>
          {credits.length === 0 ? (
            <Card className="mt-3">
              <CardDescription>No credits on this card yet.</CardDescription>
              {!template && (
                <form
                  action={applyTemplateAction}
                  className="mt-3 flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={card.id} />
                  <select
                    name="template"
                    aria-label="Card template"
                    className={cn(select, "w-auto")}
                  >
                    {CATALOG.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">
                    Fill from template
                  </Button>
                </form>
              )}
            </Card>
          ) : (
            <div className="mt-3 space-y-3">
              {credits.map((b) => {
                const cadence = isCadence(b.cadence) ? b.cadence : ("annual" as Cadence);
                const periods = periodsThisYear(cadence, today, card.openedOn);
                const expired = Boolean(b.endsOn && b.endsOn < today);
                return (
                  <Card key={b.id} className={cn("p-5", (!b.tracked || expired) && "opacity-60")}>
                    <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {b.amountCents > 0 && (
                            <span className="tabular-nums">{formatCents(b.amountCents)} </span>
                          )}
                          {b.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {CADENCE_LABEL[cadence]}
                          {b.endsOn &&
                            ` · ${expired ? "ended" : "ends"} ${formatDate(b.endsOn, today)}`}
                          {b.notes && ` · ${b.notes}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {b.enrollRequired && (
                          <form
                            action={setBenefitFlagAction.bind(null, b.id, "enrolled", !b.enrolled)}
                          >
                            <Button
                              type="submit"
                              size="sm"
                              variant={b.enrolled ? "ghost" : "outline"}
                            >
                              {b.enrolled ? "✓ Enrolled" : "Mark enrolled"}
                            </Button>
                          </form>
                        )}
                        <form action={setBenefitFlagAction.bind(null, b.id, "tracked", !b.tracked)}>
                          <Button type="submit" size="sm" variant="ghost">
                            {b.tracked ? "Stop tracking" : "Track again"}
                          </Button>
                        </form>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {periods.map((p) => {
                        const logged = usedIn(usage, b.id, p.key);
                        const full = logged !== undefined && logged >= b.amountCents;
                        const partial = !full && (logged ?? 0) > 0;
                        const future = p.start > today;
                        const action = (full || partial ? clearUsedAction : markUsedAction).bind(
                          null,
                          b.id,
                          p.key,
                        );
                        return (
                          <form key={p.key} action={action}>
                            <button
                              type="submit"
                              disabled={future}
                              aria-pressed={full}
                              title={
                                full
                                  ? `${p.label}: used`
                                  : partial
                                    ? `${p.label}: ${formatCents(logged!)} used`
                                    : `${p.label}: not used`
                              }
                              className={cn(
                                "min-w-12 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
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
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Edit
                      </summary>
                      <ActionForm
                        action={updateBenefitAction}
                        submit="Save"
                        size="sm"
                        className="mt-3 space-y-4"
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <BenefitFields prefix={b.id} values={b} />
                      </ActionForm>
                      <form action={deleteBenefitAction.bind(null, b.id)} className="mt-2">
                        <Button
                          type="submit"
                          size="sm"
                          variant="link"
                          className="px-0 text-destructive"
                        >
                          Delete this credit
                        </Button>
                      </form>
                    </details>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {perks.length > 0 && !card.closed && (
        <section>
          <h2 className="text-lg font-semibold">Perks worth remembering</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {perks.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    {b.notes && <p className="text-sm text-muted-foreground">{b.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {b.enrollRequired && (
                      <form action={setBenefitFlagAction.bind(null, b.id, "enrolled", !b.enrolled)}>
                        <Button type="submit" size="sm" variant={b.enrolled ? "ghost" : "outline"}>
                          {b.enrolled ? "✓ Enrolled" : "Mark enrolled"}
                        </Button>
                      </form>
                    )}
                    <form action={deleteBenefitAction.bind(null, b.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        aria-label={`Remove ${b.name}`}
                      >
                        Remove
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {!card.closed && (
        <Card className="max-w-3xl">
          <CardTitle>Add a benefit</CardTitle>
          <ActionForm action={addBenefitAction} submit="Add benefit" className="mt-4 space-y-4">
            <input type="hidden" name="cardId" value={card.id} />
            <BenefitFields prefix="new" />
          </ActionForm>
        </Card>
      )}

      <Card className="max-w-3xl">
        <CardTitle>Card details</CardTitle>
        <ActionForm action={updateCardAction} submit="Save" className="mt-4 space-y-4">
          <input type="hidden" name="id" value={card.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="card-name">Name</Label>
              <Input id="card-name" name="name" defaultValue={card.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-issuer">Issuer</Label>
              <Input id="card-issuer" name="issuer" defaultValue={card.issuer} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-opened">Opened</Label>
              <Input
                id="card-opened"
                name="openedOn"
                type="date"
                defaultValue={card.openedOn ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="card-fee">Annual fee, $</Label>
              <Input
                id="card-fee"
                name="annualFee"
                inputMode="decimal"
                defaultValue={String(card.annualFeeCents / 100)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="business" defaultChecked={card.business} /> Business card
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="closed" defaultChecked={card.closed} /> Closed
            </label>
          </div>
        </ActionForm>
        <form action={deleteCardAction} className="mt-4 border-t pt-4">
          <input type="hidden" name="id" value={card.id} />
          <Button type="submit" variant="link" className="px-0 text-destructive">
            Delete this card and its history
          </Button>
        </form>
      </Card>
    </div>
  );
}

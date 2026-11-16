import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardDescription, CardTitle, Input, Label, cn } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { BenefitFields } from "@/components/benefit-fields";
import { CardIcon } from "@/components/card-icon";
import { Meter } from "@/components/meter";
import { UsageChips } from "@/components/usage-chips";
import { CATALOG, CATALOG_REVIEWED, getTemplate } from "@/lib/catalog";
import { catalogUpdates, updateCount as countUpdates } from "@/lib/catalog-sync";
import { formatCents } from "@/lib/money";
import { msrStatus } from "@/lib/msr";
import { cardWorth, faceValueCents, myValueCents } from "@/lib/worth";
import {
  cardStandings,
  getCard,
  listReferrals,
  loadPortfolio,
  today as getToday,
} from "@/lib/perks";
import { friendsLinksFor } from "@/lib/referrals";
import { CADENCE_LABEL, formatDate, isCadence, type Cadence } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { indexUsage, summarizeCards } from "@/lib/summary";
import {
  addBenefitAction,
  applyCatalogUpdatesAction,
  applyTemplateAction,
  deleteBenefitAction,
  deleteCardAction,
  setBenefitFlagAction,
  updateBenefitAction,
  saveWorthAction,
  updateBonusAction,
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
  const msr = msrStatus(card, today);
  const standings =
    card.templateKey && !card.closed ? await cardStandings(card.templateKey, user.id, today) : [];
  const medals = ["1st", "2nd", "3rd"];
  const referrals = card.templateKey && !card.closed ? await listReferrals() : [];
  const myLink = referrals.find((r) => r.userId === user.id && r.templateKey === card.templateKey);
  const friendsLinks = friendsLinksFor(referrals, card.templateKey, user.id);
  const worth = cardWorth(benefits, card.annualFeeCents, today);
  const worthRows = benefits.filter((b) => !(b.endsOn && b.endsOn < today));
  const updates = catalogUpdates(card.templateKey, benefits);
  const updateCount = countUpdates(updates);

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
          <CardIcon
            templateKey={card.templateKey}
            issuer={card.issuer}
            closed={card.closed}
            className="h-7 w-11"
          />
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

      {card.templateKey && !card.closed && (
        <Card className="flex max-w-xl flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">Referral link</p>
            <p className="text-muted-foreground">
              {myLink
                ? "Your link is shared with the group. Friends who apply through it earn you the referral bonus."
                : "Share your link for this card. Friends who apply through it get the bonus and you earn one too."}
              {friendsLinks.length > 0 &&
                ` ${friendsLinks.map((r) => r.firstName).join(" and ")} shared one too.`}
            </p>
          </div>
          <Link
            href={
              myLink
                ? "/dashboard/bonuses#referrals"
                : (`/dashboard/bonuses?share=${encodeURIComponent(card.templateKey)}#share` as never)
            }
            className="shrink-0"
          >
            <Button size="sm" variant={myLink ? "outline" : "default"}>
              {myLink ? "See links" : "Share my link"}
            </Button>
          </Link>
        </Card>
      )}

      {standings.length >= 2 && (
        <Card className="max-w-xl">
          <p className="text-sm text-muted-foreground">
            How you compare on this card in {today.slice(0, 4)}
          </p>
          <ol className="mt-3 space-y-3">
            {standings.map((s, i) => (
              <li key={s.cardId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={s.userId === user.id ? "font-semibold" : undefined}>
                    <span className="mr-2 inline-block w-8 text-muted-foreground">
                      {medals[i] ?? `${i + 1}th`}
                    </span>
                    {s.userId === user.id ? "You" : s.firstName}
                  </span>
                  <span className="tabular-nums">
                    {formatCents(s.capturedCents)}
                    <span className="text-muted-foreground">
                      {s.availableCents ? ` · ${Math.round(s.share * 100)}% used` : ""}
                    </span>
                  </span>
                </div>
                <Meter
                  value={s.capturedCents}
                  max={Math.max(...standings.map((x) => x.capturedCents), 1)}
                  className="mt-1"
                />
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Ranked by credits used. Only these totals are shared; anyone can opt out in Settings.
          </p>
        </Card>
      )}

      {msr && msr.state !== "received" && (
        <Card className="max-w-xl">
          <p className="text-sm text-muted-foreground">
            Sign-up bonus{card.bonusText ? `: ${card.bonusText}` : ""}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
            {formatCents(msr.spentCents)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              of {formatCents(msr.requiredCents)} spent
            </span>
          </p>
          <Meter value={msr.spentCents} max={msr.requiredCents} className="mt-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            {msr.state === "met"
              ? "Spend requirement met. Mark the bonus received once it posts."
              : msr.state === "missed"
                ? `The deadline passed with ${formatCents(msr.leftCents)} to go.`
                : `${formatCents(msr.leftCents)} to go${msr.daysLeft !== null ? `, ${msr.daysLeft} days left (about ${formatCents(msr.perDayCents ?? 0)} a day)` : ""}.`}
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
          {updateCount > 0 && credits.length > 0 && (
            <form
              action={applyCatalogUpdatesAction.bind(null, card.id)}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-primary/40 bg-primary/5 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                The catalog has {updateCount} update{updateCount === 1 ? "" : "s"} for this card:{" "}
                {[
                  ...updates.added.map((t) => `new ${t.name}`),
                  ...updates.changed.map((c) => `${c.benefit.name} changed`),
                  ...updates.removed.map((b) => `${b.name} removed`),
                ].join(", ")}
                .
              </span>
              <Button type="submit" size="sm">
                Apply
              </Button>
            </form>
          )}
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

                    <UsageChips
                      benefitId={b.id}
                      amountCents={b.amountCents}
                      cadence={cadence}
                      openedOn={card.openedOn}
                      usage={usage}
                      today={today}
                    />

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
        <details className="group max-w-3xl rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
            <CardTitle>Add a benefit</CardTitle>
            <ChevronDown
              aria-hidden
              className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <ActionForm action={addBenefitAction} submit="Add benefit" className="space-y-4">
              <input type="hidden" name="cardId" value={card.id} />
              <BenefitFields prefix="new" />
            </ActionForm>
          </div>
        </details>
      )}

      {worthRows.length > 0 && (
        <details className="group max-w-3xl rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
            <span>
              <CardTitle>Is it worth the {formatCents(card.annualFeeCents)} fee?</CardTitle>
              <CardDescription className="mt-1">
                Advertised {formatCents(worth.advertisedCents)} a year, worth{" "}
                {formatCents(worth.worthCents)} to you:{" "}
                <span
                  className={
                    worth.netCents >= 0
                      ? "font-medium text-success"
                      : "font-medium text-destructive"
                  }
                >
                  {worth.netCents >= 0
                    ? `${formatCents(worth.netCents)} ahead`
                    : `${formatCents(-worth.netCents)} short`}
                </span>
              </CardDescription>
            </span>
            <ChevronDown
              aria-hidden
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <p className="mb-3 text-sm text-muted-foreground">
              Put what each benefit is really worth to you per year. Blank uses the advertised value
              for credits you track and $0 for everything else. Status and lounge access count too
              if they matter to you.
            </p>
            <ActionForm action={saveWorthAction} submit="Save values" className="space-y-3">
              <input type="hidden" name="cardId" value={card.id} />
              <ul className="divide-y text-sm">
                {worthRows.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {faceValueCents(b) > 0
                          ? `Advertised ${formatCents(faceValueCents(b))}/yr`
                          : "No dollar value"}
                        {!b.tracked && " · not tracked"}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      $
                      <Input
                        name={`worth_${b.id}`}
                        inputMode="decimal"
                        aria-label={`Worth to me per year: ${b.name}`}
                        defaultValue={b.myValueCents === null ? "" : String(b.myValueCents / 100)}
                        placeholder={String(myValueCents(b) / 100)}
                        className="h-9 w-24"
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </ActionForm>
          </div>
        </details>
      )}

      <details
        className="group max-w-3xl rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm"
        open={Boolean(msr && msr.state === "active")}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
          <CardTitle>Sign-up bonus</CardTitle>
          <ChevronDown
            aria-hidden
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <ActionForm action={updateBonusAction} submit="Save" className="space-y-4">
            <input type="hidden" name="id" value={card.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bonus-text">Bonus</Label>
                <Input
                  id="bonus-text"
                  name="bonus"
                  defaultValue={card.bonusText}
                  placeholder="60,000 points"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-msr">Spend required, $</Label>
                <Input
                  id="bonus-msr"
                  name="msr"
                  inputMode="decimal"
                  defaultValue={card.msrCents ? String(card.msrCents / 100) : ""}
                  placeholder="4000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-deadline">Spend by</Label>
                <Input
                  id="bonus-deadline"
                  name="deadline"
                  type="date"
                  defaultValue={card.msrDeadline ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-spent">Spent so far, $</Label>
                <Input
                  id="bonus-spent"
                  name="spent"
                  inputMode="decimal"
                  defaultValue={String(card.msrSpentCents / 100)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-received">Bonus received on</Label>
                <Input
                  id="bonus-received"
                  name="received"
                  type="date"
                  defaultValue={card.bonusReceivedOn ?? ""}
                />
              </div>
            </div>
          </ActionForm>
        </div>
      </details>

      {/* Open by default while the opened date is missing, since credits and fees depend on it. */}
      <details
        className="group max-w-3xl rounded-[calc(var(--radius)+4px)] border bg-card shadow-sm"
        open={!card.openedOn}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 sm:p-6">
          <span>
            <CardTitle>Card details</CardTitle>
            {!card.openedOn && (
              <CardDescription className="mt-1">
                Add the date you opened this card so fee reminders and card-year credits are right.
              </CardDescription>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <ActionForm action={updateCardAction} submit="Save" className="space-y-4">
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
                <input type="checkbox" name="business" defaultChecked={card.business} /> Business
                card
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
        </div>
      </details>
    </div>
  );
}

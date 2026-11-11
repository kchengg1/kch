import Link from "next/link";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { CreditRow, dueLabel } from "@/components/credit-row";
import { Meter } from "@/components/meter";
import { formatCents } from "@/lib/money";
import { listOffers, loadPortfolio, today as getToday } from "@/lib/perks";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { actionable, buildStatuses, summarizeCards } from "@/lib/summary";

/** Credits ending within this window sit in the main list; the rest are tucked below. */
const SOON_DAYS = 45;
const OFFER_DAYS = 14;
const FEE_DAYS = 60;

export default async function DashboardPage() {
  const { user } = await requireSession();
  const today = getToday();
  const [{ cards, benefits, usage }, offers] = await Promise.all([
    loadPortfolio(user.id),
    listOffers(user.id),
  ]);
  const open = cards.filter((c) => !c.closed);

  if (open.length === 0) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardTitle>Add your cards to get started</CardTitle>
        <CardDescription className="mt-2">
          Paste your card spreadsheet to bring everything in at once, or add cards one at a time.
          Cards the tracker recognises come with their credits already filled in.
        </CardDescription>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard/cards/import">
            <Button>Import from spreadsheet</Button>
          </Link>
          <Link href="/dashboard/cards">
            <Button variant="outline">Add a card</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const todo = actionable(buildStatuses(cards, benefits, usage, today));
  const soon = todo.filter((s) => (s.daysLeft ?? 0) <= SOON_DAYS);
  const later = todo.filter((s) => (s.daysLeft ?? 0) > SOON_DAYS);
  const thisMonth = todo.filter((s) => s.deadline && s.deadline.slice(0, 7) === today.slice(0, 7));
  const sum = (list: typeof todo) => list.reduce((n, s) => n + s.remainingCents, 0);

  const summaries = summarizeCards(cards, benefits, usage, today);
  const captured = summaries.reduce((n, s) => n + s.capturedCents, 0);
  const available = summaries.reduce((n, s) => n + s.availableCents, 0);
  const fees = open.reduce((n, c) => n + c.annualFeeCents, 0);

  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  const expiringOffers = offers.filter(
    (o) =>
      (o.status === "available" || o.status === "added") &&
      o.expiresOn !== null &&
      o.expiresOn >= today &&
      daysBetween(today, o.expiresOn) <= OFFER_DAYS,
  );
  const feesDue = summaries
    .filter((s) => s.nextFeeOn && daysBetween(today, s.nextFeeOn) <= FEE_DAYS)
    .sort((a, b) => a.nextFeeOn!.localeCompare(b.nextFeeOn!));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0] || "there"}</h1>
        <p className="text-muted-foreground">
          {todo.length === 0
            ? "Every tracked credit is used for its current period."
            : `${formatCents(sum(thisMonth))} in credits expires this month.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Expiring this month"
          value={formatCents(sum(thisMonth))}
          detail={`${thisMonth.length} credit${thisMonth.length === 1 ? "" : "s"} still unused`}
        />
        <Stat
          label={`Used in ${today.slice(0, 4)}`}
          value={formatCents(captured)}
          detail={`of ${formatCents(available)} in yearly credits you track`}
          meter={{ value: captured, max: available }}
        />
        <Stat
          label="Annual fees"
          value={formatCents(fees)}
          detail={
            captured >= fees
              ? `Credits used cover them by ${formatCents(captured - fees)}`
              : `${formatCents(fees - captured)} more in credits to break even`
          }
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Use these next</h2>
        <Card className="mt-3 py-2">
          {soon.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nothing is due in the next {SOON_DAYS} days.
            </p>
          ) : (
            <ul className="divide-y">
              {soon.map((s) => (
                <CreditRow key={s.benefit.id} status={s} today={today} />
              ))}
            </ul>
          )}
        </Card>
        {later.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {later.length} more with later deadlines, worth {formatCents(sum(later))}
            </summary>
            <Card className="mt-3 py-2">
              <ul className="divide-y">
                {later.map((s) => (
                  <CreditRow key={s.benefit.id} status={s} today={today} />
                ))}
              </ul>
            </Card>
          </details>
        )}
      </section>

      {expiringOffers.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Offers expiring soon</h2>
            <Link href="/dashboard/offers" className="text-sm text-primary hover:underline">
              All offers
            </Link>
          </div>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {expiringOffers.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {o.merchant}{" "}
                      {o.status === "available" && <Badge variant="outline">Not added yet</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {o.details}
                      {o.cardId && cardName.has(o.cardId) ? ` · ${cardName.get(o.cardId)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {dueLabel(daysBetween(today, o.expiresOn!))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {feesDue.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Annual fees coming up</h2>
          <Card className="mt-3 py-2">
            <ul className="divide-y">
              {feesDue.map((s) => (
                <li key={s.card.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/dashboard/cards/${s.card.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.card.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatCents(s.card.annualFeeCents)} fee around{" "}
                      {formatDate(s.nextFeeOn!, today)} · {formatCents(s.capturedCents)} in credits
                      used this year
                    </p>
                  </div>
                  <Badge
                    variant={s.capturedCents >= s.card.annualFeeCents ? "success" : "secondary"}
                  >
                    {s.capturedCents >= s.card.annualFeeCents
                      ? "Paying for itself"
                      : "Review before renewal"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">By card</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {summaries
            .filter((s) => s.availableCents > 0 || s.card.annualFeeCents > 0)
            .sort((a, b) => b.availableCents - a.availableCents)
            .map((s) => (
              <Link key={s.card.id} href={`/dashboard/cards/${s.card.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <div className="flex items-baseline justify-between gap-3">
                    <CardTitle className="text-base">{s.card.name}</CardTitle>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatCents(s.card.annualFeeCents)} fee
                    </span>
                  </div>
                  {s.availableCents > 0 ? (
                    <>
                      <p className="mt-3 text-sm">
                        <span className="font-semibold tabular-nums">
                          {formatCents(s.capturedCents)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          of {formatCents(s.availableCents)} used
                        </span>
                      </p>
                      <Meter value={s.capturedCents} max={s.availableCents} className="mt-2" />
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No credits to track</p>
                  )}
                </Card>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  meter,
}: {
  label: string;
  value: string;
  detail: string;
  meter?: { value: number; max: number };
}) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {meter && <Meter {...meter} className="mt-3" />}
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardDescription, CardTitle } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { StatementImport } from "@/components/statement-import";
import { onStatement } from "@/lib/catalog";
import { UsageChips } from "@/components/usage-chips";
import { formatCents } from "@/lib/money";
import { loadPortfolio, today as getToday } from "@/lib/perks";
import { CADENCE_LABEL, isCadence } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { indexUsage } from "@/lib/summary";
import { saveStatementCreditsAction } from "../actions";

export const metadata: Metadata = { title: "Catch up" };

export default async function CatchUpPage() {
  const { user } = await requireSession();
  const today = getToday();
  const { cards, benefits, usage } = await loadPortfolio(user.id);
  const index = indexUsage(usage);
  const open = cards.filter((c) => !c.closed);
  const credits = (cardId: string) =>
    benefits.filter(
      (b) =>
        b.cardId === cardId &&
        b.tracked &&
        b.cadence !== "perk" &&
        b.amountCents > 0 &&
        !(b.endsOn && b.endsOn < today),
    );
  const withCredits = open.filter((c) => credits(c.id).length > 0);
  // Credits applied in an app or at checkout never reach a statement, so the import must not offer them.
  const statementCredits = (card: (typeof open)[number]) =>
    credits(card.id).filter((b) => onStatement(card.templateKey, b.name));
  const importable = withCredits.filter((c) => statementCredits(c).length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Catch up on {today.slice(0, 4)}</h1>
        <p className="text-muted-foreground">
          Record credits you used before you started tracking, so totals and break-even are right.
        </p>
      </div>

      <Card className="max-w-4xl">
        <CardTitle>1. Import statement credits</CardTitle>
        <CardDescription className="mt-1">
          Download this year&rsquo;s transactions as a CSV: on americanexpress.com, open Statements
          &amp; Activity, choose the date range and Download → CSV; on chase.com, open the
          card&rsquo;s activity, then Download account activity → CSV. Upload one file per card.
          Every credit in it is listed with a suggested benefit for you to confirm. Uploading the
          same file again is safe.
        </CardDescription>
        <div className="mt-4">
          {importable.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add cards with credits first.</p>
          ) : (
            <StatementImport
              action={saveStatementCreditsAction}
              cards={importable.map((c) => ({
                id: c.id,
                name: c.name,
                benefits: statementCredits(c).map((b) => ({ id: b.id, name: b.name })),
              }))}
            />
          )}
        </div>
      </Card>

      <section className="max-w-4xl">
        <h2 className="text-lg font-semibold">2. Tap the rest</h2>
        <p className="text-sm text-muted-foreground">
          Credits taken off inside an app or at checkout never appear on a statement: Uber Cash,
          Lyft, DoorDash, the Capital One Travel credit, anniversary miles and free night
          certificates. They are labelled &ldquo;Applied in app&rdquo; below. Tap the periods you
          used, or &ldquo;Mark earlier periods used&rdquo; if you used every one.
        </p>
        <div className="mt-4 space-y-4">
          {withCredits.map((card) => (
            <Card key={card.id} className="p-5">
              <Link
                href={`/dashboard/cards/${card.id}`}
                className="inline-flex items-center gap-2 font-semibold hover:underline"
              >
                <CardIcon templateKey={card.templateKey} issuer={card.issuer} />
                {card.name}
              </Link>
              <ul className="mt-2 divide-y">
                {credits(card.id).map((b) =>
                  isCadence(b.cadence) ? (
                    <li key={b.id} className="py-3">
                      <p className="text-sm">
                        <span className="font-medium">
                          {formatCents(b.amountCents)} {b.name}
                        </span>
                        <span className="text-muted-foreground"> · {CADENCE_LABEL[b.cadence]}</span>
                        {!onStatement(card.templateKey, b.name) && (
                          <Badge variant="outline" className="ml-2">
                            Applied in app
                          </Badge>
                        )}
                      </p>
                      <UsageChips
                        benefitId={b.id}
                        amountCents={b.amountCents}
                        cadence={b.cadence}
                        openedOn={card.openedOn}
                        usage={index}
                        today={today}
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { Badge, Card, CardTitle } from "@kch/ui";
import data from "@/data/signup-bonuses.json";
import { checkEligibility, fiveTwentyFour, type BonusOffer, type Verdict } from "@/lib/eligibility";
import { formatCents } from "@/lib/money";
import { loadPortfolio, today as getToday } from "@/lib/perks";
import { formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign-up bonuses" };

const ORDER: Record<Verdict["status"], number> = { eligible: 0, caution: 1, ineligible: 2 };
const LABEL: Record<Verdict["status"], string> = {
  eligible: "Looks eligible",
  caution: "Check terms",
  ineligible: "Not eligible",
};

export default async function BonusesPage() {
  const { user } = await requireSession();
  const today = getToday();
  const { cards } = await loadPortfolio(user.id);
  const count = fiveTwentyFour(cards, today);
  const rows = (data.offers as BonusOffer[])
    .map((offer) => ({ offer, verdict: checkEligibility(offer, cards, today) }))
    .sort(
      (a, b) =>
        ORDER[a.verdict.status] - ORDER[b.verdict.status] ||
        (b.offer.estValue ?? 0) - (a.offer.estValue ?? 0),
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sign-up bonuses</h1>
        <p className="text-muted-foreground">
          Notable offers as of {formatDate(data.asOf)}, checked against your card history. You are
          at <span className="font-medium text-foreground">{count}/24</span> for Chase.
        </p>
      </div>

      {cards.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">
            Import your card history, including closed cards, to see which bonuses you can still
            get.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map(({ offer, verdict }) => (
          <Card
            key={offer.id}
            className={verdict.status === "ineligible" ? "opacity-60" : undefined}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {offer.card}
                  {offer.elevated && <Badge>Elevated</Badge>}
                  {offer.business && <Badge variant="secondary">Business</Badge>}
                </CardTitle>
                <p className="mt-1 text-xl font-bold tracking-tight">{offer.bonus}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    offer.spend
                      ? `after ${offer.spend}`
                      : "spend requirement varies, see the offer",
                    `${formatCents(offer.annualFee * 100)} annual fee`,
                    offer.estValue !== null &&
                      `worth about ${formatCents(offer.estValue * 100)} at your valuations`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Badge
                variant={
                  verdict.status === "eligible"
                    ? "success"
                    : verdict.status === "caution"
                      ? "outline"
                      : "secondary"
                }
              >
                {LABEL[verdict.status]}
              </Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {verdict.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {offer.note && <li>{offer.note}</li>}
            </ul>
            {offer.url && (
              <a
                href={offer.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                Where this was reported
              </a>
            )}
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Eligibility is an estimate from published issuer rules and your card dates. The issuer makes
        the final call, and offers change without notice. Point values use 2¢ for Amex and Chase,
        1.4¢ for Capital One, 1.5¢ for Aeroplan and 0.85¢ for Marriott, taken from your spreadsheet.
      </p>
    </div>
  );
}

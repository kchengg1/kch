import type { Metadata } from "next";
import { Badge, Card, CardTitle, cn } from "@kch/ui";
import { CardIcon } from "@/components/card-icon";
import { shareableCards } from "@/lib/referrals";
import data from "@/data/signup-bonuses.json";
import { checkEligibility, fiveTwentyFour, type BonusOffer, type Verdict } from "@/lib/eligibility";
import { formatCents } from "@/lib/money";
import { applicationRules } from "@/lib/rules";
import { listReferrals, loadPortfolio, today as getToday } from "@/lib/perks";
import { CardsNav } from "@/components/dashboard-nav";
import { ReferralForm } from "@/components/referral-form";
import { deleteReferralAction } from "../actions";
import { Button } from "@kch/ui";
import { formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Bonuses and referrals" };

const ORDER: Record<Verdict["status"], number> = { eligible: 0, caution: 1, ineligible: 2 };
const LABEL: Record<Verdict["status"], string> = {
  eligible: "Looks eligible",
  caution: "Check terms",
  ineligible: "Not eligible",
};

export default async function BonusesPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>;
}) {
  const { user } = await requireSession();
  const { share } = await searchParams;
  const today = getToday();
  const [{ cards }, referrals] = await Promise.all([loadPortfolio(user.id), listReferrals()]);
  const mine = referrals.filter((r) => r.userId === user.id);
  const others = referrals.filter((r) => r.userId !== user.id);
  const shareable = shareableCards(cards, referrals, user.id);
  /** Links from others in the group for a sign-up offer's card. */
  const referralsFor = (offer: BonusOffer) => {
    const re = new RegExp(offer.match, "i");
    return others.filter(
      (r) => (offer.templateKey && r.templateKey === offer.templateKey) || re.test(r.cardName),
    );
  };
  const count = fiveTwentyFour(cards, today);
  const rules = applicationRules(cards, today);
  const rows = (data.offers as BonusOffer[])
    .map((offer) => ({ offer, verdict: checkEligibility(offer, cards, today) }))
    .sort(
      (a, b) =>
        ORDER[a.verdict.status] - ORDER[b.verdict.status] ||
        (b.offer.estValue ?? 0) - (a.offer.estValue ?? 0),
    );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <CardsNav />
        <div>
          <h1 className="text-2xl font-bold">Bonuses and referrals</h1>
          <p className="text-muted-foreground">
            Notable offers as of {formatDate(data.asOf)}, checked against your card history. You are
            at <span className="font-medium text-foreground">{count}/24</span> for Chase.
          </p>
        </div>
      </div>

      <section id="referrals" className="scroll-mt-20 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Referral links</h2>
          <p className="text-sm text-muted-foreground">
            Shared with everyone in Perks, so sign-up bonuses stay in the group.
          </p>
        </div>
        <Card className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="font-medium">1. Share yours</p>
            <p className="text-muted-foreground">
              Add the referral link for each card you have. Find it in the issuer&rsquo;s app under
              &ldquo;Refer a friend&rdquo;.
            </p>
          </div>
          <div>
            <p className="font-medium">2. Use theirs</p>
            <p className="text-muted-foreground">
              Before applying for a card, check here. Applying through a friend&rsquo;s link gets
              you the same bonus and earns them one too.
            </p>
          </div>
          <div>
            <p className="font-medium">3. Everyone earns</p>
            <p className="text-muted-foreground">
              Referral bonuses are often 10,000 to 40,000 points. Amex pays for up to 5 a year and
              Chase caps them at 50,000 to 200,000 points; both reset January 1.
            </p>
          </div>
        </Card>
        {shareable.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Ready to share: {shareable.length} card{shareable.length === 1 ? "" : "s"} you have
              without a link yet
            </p>
            <div className="flex flex-wrap gap-2">
              {shareable.map((c) => (
                <a
                  key={c.id}
                  href={`/dashboard/bonuses?share=${encodeURIComponent(c.templateKey!)}#share`}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-muted",
                    share === c.templateKey && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  <CardIcon
                    templateKey={c.templateKey}
                    issuer={c.issuer}
                    className="h-3 w-[19px]"
                  />
                  {c.name}
                  <span className="text-primary">Share</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {others.length > 0 && (
          <Card className="py-2">
            <p className="pt-2 text-sm font-medium">Friends&rsquo; links</p>
            <ul className="divide-y text-sm">
              {others.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.cardName}</p>
                    <p className="text-muted-foreground">
                      {r.firstName}&rsquo;s link{r.reward ? ` · they earn ${r.reward}` : ""}
                    </p>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    Open link
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {mine.length > 0 && (
          <Card className="py-2">
            <p className="pt-2 text-sm font-medium">Your shared links</p>
            <ul className="divide-y text-sm">
              {mine.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0 truncate">
                    {r.cardName}
                    {r.reward && <span className="text-muted-foreground"> · {r.reward}</span>}
                  </span>
                  <form action={deleteReferralAction.bind(null, r.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Remove
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card id="share" className="max-w-3xl scroll-mt-20">
          <CardTitle className="text-base">Share a referral link</CardTitle>
          <div className="mt-4">
            <ReferralForm
              myTemplateKeys={cards
                .filter((c) => !c.closed && c.templateKey)
                .map((c) => c.templateKey!)}
              defaultKey={share ?? shareable[0]?.templateKey ?? undefined}
            />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Application rules</h2>
        <p className="text-sm text-muted-foreground">
          Worked out from the dates your cards were opened. These are widely reported rules of
          thumb, so treat them as a guide.
        </p>
        <Card className="mt-3 py-2">
          <ul className="divide-y">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.detail}</p>
                </div>
                <Badge variant={r.status === "clear" ? "success" : "outline"} className="shrink-0">
                  {r.status === "clear" ? "Clear" : `Wait until ${formatDate(r.until!, today)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </section>

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
            {referralsFor(offer).length > 0 && verdict.status !== "ineligible" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {referralsFor(offer).map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success hover:bg-success/20"
                  >
                    Apply with {r.firstName}&rsquo;s referral
                  </a>
                ))}
              </div>
            )}
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

import type { Metadata } from "next";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { dueLabel } from "@/components/credit-row";
import { OfferPaste } from "@/components/offer-paste";
import { formatCents } from "@/lib/money";
import { listOffers, loadPortfolio, today as getToday } from "@/lib/perks";
import { daysBetween, formatDate } from "@/lib/periods";
import { requireSession } from "@/lib/session";
import { deleteOfferAction, saveOffersAction, setOfferStatusAction } from "../actions";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  const { user } = await requireSession();
  const today = getToday();
  const [{ cards }, offers] = await Promise.all([loadPortfolio(user.id), listOffers(user.id)]);
  const cardName = new Map(cards.map((c) => [c.id, c.name]));
  // Amex and Chase run the offer programs, so list those cards first.
  const openCards = cards
    .filter((c) => !c.closed)
    .sort(
      (a, b) =>
        Number(/american express|chase/i.test(b.issuer)) -
          Number(/american express|chase/i.test(a.issuer)) || a.name.localeCompare(b.name),
    );

  const expired = (o: (typeof offers)[number]) => o.expiresOn !== null && o.expiresOn < today;
  const live = offers.filter(
    (o) => (o.status === "available" || o.status === "added") && !expired(o),
  );
  const past = offers.filter((o) => !live.includes(o));
  const liveValue = live.reduce((n, o) => n + (o.valueCents ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="text-muted-foreground">
          {live.length === 0
            ? "Amex Offers and Chase Offers you have saved show up here with their expiry dates."
            : `${live.length} live offer${live.length === 1 ? "" : "s"}, worth up to ${formatCents(liveValue)} back.`}
        </p>
      </div>

      {live.length > 0 && (
        <Card className="py-2">
          <ul className="divide-y">
            {live.map((o) => {
              const days = o.expiresOn ? daysBetween(today, o.expiresOn) : null;
              return (
                <li
                  key={o.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {o.merchant}
                      <Badge variant={o.status === "added" ? "success" : "outline"}>
                        {o.status === "added" ? "Added to card" : "Not added yet"}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">{o.details}</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        o.cardId && cardName.get(o.cardId),
                        o.expiresOn
                          ? `expires ${formatDate(o.expiresOn, today)}`
                          : "no expiry saved",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {days !== null && (
                        <span className={days <= 7 ? "font-medium text-destructive" : undefined}>
                          {" · "}
                          {dueLabel(days)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {o.status === "available" && (
                      <form action={setOfferStatusAction.bind(null, o.id, "added")}>
                        <Button type="submit" size="sm" variant="outline">
                          Added to card
                        </Button>
                      </form>
                    )}
                    <form action={setOfferStatusAction.bind(null, o.id, "used")}>
                      <Button type="submit" size="sm">
                        Used
                      </Button>
                    </form>
                    <form action={setOfferStatusAction.bind(null, o.id, "dismissed")}>
                      <Button type="submit" size="sm" variant="ghost">
                        Skip
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="max-w-3xl">
        <CardTitle>Add offers</CardTitle>
        <CardDescription className="mt-1">
          Amex and Chase do not let apps read your offers, so bring them in by copy and paste. Open
          the offers page for one card, select the whole page (Ctrl/Cmd + A), copy, and paste below.
          Offers you already saved are skipped, so pasting the same page again is safe.
        </CardDescription>
        <div className="mt-4">
          <OfferPaste action={saveOffersAction} cards={openCards} today={today} />
        </div>
      </Card>

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {past.length} used, skipped or expired
          </summary>
          <Card className="mt-3 py-2">
            <ul className="divide-y text-sm">
              {past.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span>
                    {o.merchant} <span className="text-muted-foreground">· {o.details}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {o.status === "used"
                        ? "Used"
                        : o.status === "dismissed"
                          ? "Skipped"
                          : "Expired"}
                    </Badge>
                    <form action={deleteOfferAction.bind(null, o.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Delete
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </div>
  );
}

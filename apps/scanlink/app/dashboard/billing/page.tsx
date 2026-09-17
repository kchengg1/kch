import Link from "next/link";
import { getEntitlements } from "@kch/payments";
import { Alert, Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { plans } from "@/app.config";
import { requireSession } from "@/lib/session";
import { openBillingPortal } from "./actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await requireSession();
  const { status } = await searchParams;
  const ent = await getEntitlements(user.id, plans);
  const sub = ent.subscription;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {status === "success" && (
        <Alert variant="success">
          Payment received. It can take a few seconds for your plan to update.
        </Alert>
      )}

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {ent.plan?.name ?? "Free"}
              {sub && (
                <Badge variant={sub.status === "active" ? "success" : "secondary"}>
                  {sub.status}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {sub?.currentPeriodEnd
                ? `${sub.cancelAtPeriodEnd ? "Ends" : "Renews"} on ${sub.currentPeriodEnd.toLocaleDateString()}`
                : ent.purchases.length > 0
                  ? "Lifetime access"
                  : "You are on the free plan."}
            </CardDescription>
          </div>
          {ent.isPaid ? (
            <form action={openBillingPortal}>
              <Button type="submit" variant="outline">
                Manage subscription
              </Button>
            </form>
          ) : (
            <Link href="/pricing">
              <Button>Upgrade</Button>
            </Link>
          )}
        </div>
      </Card>

      {ent.purchases.length > 0 && (
        <Card>
          <CardTitle>Purchases</CardTitle>
          <ul className="mt-3 divide-y text-sm">
            {ent.purchases.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{plans.find((pl) => pl.priceId === p.priceId)?.name ?? p.priceId}</span>
                <span className="text-muted-foreground">
                  {(p.amountTotal / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: p.currency,
                  })}
                  {" · "}
                  {p.createdAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

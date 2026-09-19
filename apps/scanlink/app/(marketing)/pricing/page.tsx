import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getEntitlements } from "@kch/payments";
import { Container } from "@kch/ui";
import { plans } from "@/app.config";
import { PricingTable } from "@/components/pricing-table";
import { getSession } from "@/lib/session";
import { checkoutUrlForPlan } from "@/app/dashboard/billing/actions";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await getSession();
  const { checkout } = await searchParams;

  // Resume a checkout that was interrupted by signup (see CheckoutButton).
  if (session && checkout) {
    const url = await checkoutUrlForPlan(checkout);
    if (url) redirect(url);
  }

  const ent = session ? await getEntitlements(session.user.id, plans) : null;

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mt-4 text-muted-foreground">Start free, upgrade when it pays for itself.</p>
      </div>
      <div className="mx-auto mt-12 max-w-3xl">
        <PricingTable plans={plans} currentPlanId={ent?.plan?.id} signedIn={Boolean(session)} />
      </div>
    </Container>
  );
}

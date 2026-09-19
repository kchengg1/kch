import { Check } from "lucide-react";
import { Badge, Card, CardDescription, CardTitle, cn } from "@kch/ui";
import type { Plan } from "@kch/payments";
import { CheckoutButton } from "./checkout-button";

export function PricingTable({
  plans,
  currentPlanId,
  signedIn,
}: {
  plans: Plan[];
  currentPlanId?: string | null;
  signedIn: boolean;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {plans.map((plan) => {
        const isCurrent = currentPlanId === plan.id;
        return (
          <Card key={plan.id} className={cn("flex flex-col", plan.highlighted && "border-primary")}>
            <div className="flex items-center justify-between">
              <CardTitle>{plan.name}</CardTitle>
              {plan.highlighted && <Badge>Popular</Badge>}
              {isCurrent && <Badge variant="success">Current plan</Badge>}
            </div>
            {plan.description && (
              <CardDescription className="mt-1">{plan.description}</CardDescription>
            )}
            <p className="mt-4">
              <span className="text-4xl font-bold">{plan.price}</span>
              {plan.interval && <span className="text-muted-foreground">{plan.interval}</span>}
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <CheckoutButton
                planId={plan.id}
                signedIn={signedIn}
                disabled={isCurrent || !plan.priceId}
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { getEntitlements } from "@kch/payments";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { plans } from "@/app.config";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const ent = await getEntitlements(user.id, plans);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0] || "there"} 👋</h1>
        <p className="text-muted-foreground">
          This is your app. Build the thing people pay for here.
        </p>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Your plan
            <Badge variant={ent.isPaid ? "success" : "secondary"}>{ent.plan?.name ?? "Free"}</Badge>
          </CardTitle>
          <CardDescription className="mt-1">
            {ent.isPaid ? "Thanks for supporting the project." : "Upgrade to unlock everything."}
          </CardDescription>
        </div>
        <Link href={ent.isPaid ? "/dashboard/billing" : "/pricing"}>
          <Button variant={ent.isPaid ? "outline" : "default"}>
            {ent.isPaid ? "Manage billing" : "Upgrade"}
          </Button>
        </Link>
      </Card>

      {/* Replace this block with the actual product. */}
      <Card className="border-dashed">
        <CardTitle>Your feature goes here</CardTitle>
        <CardDescription className="mt-1">
          Gate paid features with <code>ent.isPaid</code> or <code>ent.plan?.id</code>.
        </CardDescription>
      </Card>
    </div>
  );
}

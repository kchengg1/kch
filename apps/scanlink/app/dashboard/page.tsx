import Link from "next/link";
import { getEntitlements } from "@kch/payments";
import { Badge, Button, Card } from "@kch/ui";
import { plans } from "@/app.config";
import { CreateCodeForm } from "@/components/create-code-form";
import { listCodes } from "@/lib/codes";
import { FREE_CODE_LIMIT } from "@/lib/limits";
import { requireSession } from "@/lib/session";
import { scanUrl } from "@/lib/qr";
import { shortenUrl } from "@/lib/validate";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const [codes, ent] = await Promise.all([listCodes(user.id), getEntitlements(user.id, plans)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your QR codes</h1>
          <p className="text-muted-foreground">
            {ent.isPaid ? (
              <>
                <Badge variant="success" className="mr-2">
                  {ent.plan?.name ?? "Pro"}
                </Badge>
                Unlimited codes with scan analytics.
              </>
            ) : (
              <>
                {codes.length} of {FREE_CODE_LIMIT} free codes used.{" "}
                <Link href="/pricing" className="underline">
                  Upgrade
                </Link>{" "}
                for unlimited codes and analytics.
              </>
            )}
          </p>
        </div>
      </div>

      <CreateCodeForm />

      {codes.length === 0 ? (
        <Card className="border-dashed text-center text-muted-foreground">
          No codes yet. Create your first one above, then download and print it.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {codes.map((code) => (
            <Card key={code.id} className="flex gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic, auth-gated SVG */}
              <img
                src={`/api/codes/${code.id}/qr?format=svg`}
                alt={`QR code for ${code.name}`}
                width={96}
                height={96}
                className="size-24 shrink-0 rounded border bg-white"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{code.name}</h2>
                <p className="truncate text-sm text-muted-foreground" title={code.targetUrl}>
                  → {shortenUrl(code.targetUrl)}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {shortenUrl(scanUrl(code.slug))}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">
                    <span className="font-semibold">{code.scanCount}</span>{" "}
                    <span className="text-muted-foreground">scans</span>
                  </span>
                  <Link href={`/dashboard/codes/${code.id}`}>
                    <Button size="sm" variant="outline">
                      Manage
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

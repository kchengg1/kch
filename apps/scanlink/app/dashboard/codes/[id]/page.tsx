import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntitlements } from "@kch/payments";
import { Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { plans } from "@/app.config";
import { CopyButton } from "@/components/copy-button";
import { DeleteCodeButton } from "@/components/delete-code-button";
import { EditCodeForm } from "@/components/edit-code-form";
import { getCode, getScanStats, TREND_DAYS } from "@/lib/codes";
import { requireSession } from "@/lib/session";
import { scanUrl } from "@/lib/qr";

export default async function CodePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const { id } = await params;
  const code = await getCode(id, user.id);
  if (!code) notFound();

  const ent = await getEntitlements(user.id, plans);
  const stats = ent.isPaid ? await getScanStats(code.id) : null;
  const link = scanUrl(code.slug);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
            ← All codes
          </Link>
          <h1 className="text-2xl font-bold">{code.name}</h1>
        </div>
        <DeleteCodeButton id={code.id} name={code.name} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic, auth-gated SVG */}
          <img
            src={`/api/codes/${code.id}/qr?format=svg`}
            alt={`QR code for ${code.name}`}
            width={256}
            height={256}
            className="size-64 rounded border bg-white"
          />
          <div className="flex w-full gap-2">
            <a href={`/api/codes/${code.id}/qr?format=png&download=1`} className="flex-1">
              <Button className="w-full">Download PNG</Button>
            </a>
            <a href={`/api/codes/${code.id}/qr?format=svg&download=1`} className="flex-1">
              <Button variant="outline" className="w-full">
                Download SVG
              </Button>
            </a>
          </div>
          <div className="w-full rounded border bg-muted p-3 text-center">
            <p className="truncate font-mono text-xs">{link}</p>
            <CopyButton value={link} className="mt-2" />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>Destination</CardTitle>
            <CardDescription className="mt-1">Where people land when they scan.</CardDescription>
            <div className="mt-4">
              <EditCodeForm id={code.id} name={code.name} targetUrl={code.targetUrl} />
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Scans</CardTitle>
                <CardDescription className="mt-1">
                  Link previews and crawlers are filtered out.
                </CardDescription>
              </div>
              <p className="text-right">
                <span className="text-3xl font-bold">{code.scanCount}</span>
                <span className="block text-xs text-muted-foreground">all time</span>
              </p>
            </div>

            {stats ? (
              <div className="mt-6 space-y-6">
                <dl className="grid grid-cols-2 gap-4">
                  <Stat label="Last 7 days" value={stats.last7} />
                  <Stat label="Last 30 days" value={stats.last30} />
                </dl>
                <Breakdown
                  title={`Scans per day, last ${TREND_DAYS} days`}
                  rows={stats.byDay.map((r) => ({ label: formatDay(r.day), value: r.scans }))}
                  empty="No scans yet."
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <Breakdown
                    title="Top sources"
                    rows={stats.topSources.map((r) => ({ label: r.source, value: r.scans }))}
                    empty="No scans yet."
                  />
                  <Breakdown
                    title="Top countries"
                    rows={stats.topCountries.map((r) => ({
                      label: formatCountry(r.country),
                      value: r.scans,
                    }))}
                    empty="No scans yet."
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded border border-dashed p-4 text-sm">
                <p className="font-medium">Daily trends, sources and countries are on Pro.</p>
                <p className="mt-1 text-muted-foreground">
                  Scans are still being counted, so upgrading later shows the full history.
                </p>
                <Link href="/pricing" className="mt-3 inline-block">
                  <Button size="sm">See plans</Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

/**
 * A compact single-series bar list: one row per item, label in ink, a bar
 * carrying magnitude, and the value at the tip. One series, so no legend is
 * needed; the title says what is plotted.
 */
function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hasData = rows.some((r) => r.value > 0);

  return (
    <section>
      <h3 className="text-sm font-medium">{title}</h3>
      {!hasData ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.label}
              className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3"
              title={`${row.label}: ${row.value} ${row.value === 1 ? "scan" : "scans"}`}
            >
              <span className="truncate text-sm text-muted-foreground">{row.label}</span>
              {/* Bar: grows from a single baseline, rounded only at the data end. */}
              <span className="h-2 w-full rounded-l-none bg-muted" aria-hidden="true">
                <span
                  className="block h-2 rounded-r-[4px] bg-primary"
                  style={{
                    width: `${Math.max(row.value === 0 ? 0 : 2, (row.value / max) * 100)}%`,
                  }}
                />
              </span>
              <span className="text-right text-sm tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "2026-09-12" -> "Sep 12". Parsed as UTC to match how scans are bucketed. */
function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const REGION = new Intl.DisplayNames(["en"], { type: "region" });

/** "GB" -> "United Kingdom", leaving "Unknown" alone. */
function formatCountry(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return REGION.of(code) ?? code;
  } catch {
    return code;
  }
}

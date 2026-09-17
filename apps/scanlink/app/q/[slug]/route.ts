import { NextResponse, after } from "next/server";
import { getCodeBySlug, recordScan } from "@/lib/codes";
import { isLikelyBot } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * The URL printed inside every QR code. Looks up the current destination,
 * redirects immediately, and records the scan after the response is sent.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = await getCodeBySlug(slug);
  if (!code) return new NextResponse("This QR code does not exist.", { status: 404 });

  const userAgent = request.headers.get("user-agent");
  if (!isLikelyBot(userAgent)) {
    const meta = {
      referer: request.headers.get("referer"),
      userAgent,
      country: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry"),
    };
    after(async () => {
      try {
        await recordScan(code.id, meta);
      } catch (err) {
        console.error("[scan] failed to record", err);
      }
    });
  }

  return NextResponse.redirect(code.targetUrl, {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}

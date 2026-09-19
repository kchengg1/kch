import { NextResponse } from "next/server";
import { getCode } from "@/lib/codes";
import { qrPng, qrSvg } from "@/lib/qr";
import { getSession } from "@/lib/session";

/** GET /api/codes/:id/qr?format=svg|png&download=1 (owner only) */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const code = await getCode(id, session.user.id);
  if (!code) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  const filename = `${code.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "qr"}-${code.slug}.${format}`;

  const headers: Record<string, string> = {
    "content-type": format === "png" ? "image/png" : "image/svg+xml",
    "cache-control": "private, max-age=3600",
  };
  if (download) headers["content-disposition"] = `attachment; filename="${filename}"`;

  const body = format === "png" ? new Uint8Array(await qrPng(code.slug)) : await qrSvg(code.slug);
  return new NextResponse(body, { headers });
}

import { NextResponse } from "next/server";
import { getMobileUser, loadMobileBootstrap } from "@/lib/mobile-server";

export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const bootstrap = await loadMobileBootstrap(user);
  return NextResponse.json(bootstrap);
}

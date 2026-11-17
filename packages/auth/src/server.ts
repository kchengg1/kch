import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { touchLastActive } from "./activity";
import type { Auth } from "./index";

export { getLastActiveAt, touchLastActive } from "./activity";

/** Record activity after the response is sent, so it never slows a request. */
export function recordActivity(userId: string) {
  try {
    after(() => touchLastActive(userId));
  } catch {
    // Outside a request scope (e.g. tests); fire and forget.
    void touchLastActive(userId);
  }
}

/** Read the current session (or null) in a Server Component / Route Handler / Action. */
export async function getSession(auth: Auth) {
  // Read headers first: during prerendering this opts the page into dynamic
  // rendering before the (lazy) auth instance is ever constructed.
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (session?.user) recordActivity(session.user.id);
  return session;
}

/** Like getSession but redirects to the login page when signed out. */
export async function requireSession(auth: Auth, loginPath = "/login") {
  const session = await getSession(auth);
  if (!session) redirect(loginPath);
  return session;
}

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Auth } from "./index";

/** Read the current session (or null) in a Server Component / Route Handler / Action. */
export async function getSession(auth: Auth) {
  // Read headers first: during prerendering this opts the page into dynamic
  // rendering before the (lazy) auth instance is ever constructed.
  const h = await headers();
  return auth.api.getSession({ headers: h });
}

/** Like getSession but redirects to the login page when signed out. */
export async function requireSession(auth: Auth, loginPath = "/login") {
  const session = await getSession(auth);
  if (!session) redirect(loginPath);
  return session;
}

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. Create one per app:
 *   export const authClient = createClient();
 * baseURL defaults to the current origin, which is right for same-domain apps.
 */
export function createClient(baseURL?: string) {
  return createAuthClient({ baseURL });
}

export type AuthClient = ReturnType<typeof createClient>;

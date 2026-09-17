import { createClient } from "@kch/auth/client";

export const authClient = createClient();
export const { useSession, signIn, signUp, signOut } = authClient;

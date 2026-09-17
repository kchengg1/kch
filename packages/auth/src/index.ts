import { db, schema } from "@kch/db";
import { resetPasswordEmail, sendEmail, verifyEmailTemplate } from "@kch/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { lazy } from "./lazy";

export type AuthOptions = {
  /** Shown in emails. */
  appName: string;
  /** Require users to verify their email before signing in. Default false (less friction). */
  requireEmailVerification?: boolean;
};

export function createAuth(options: AuthOptions) {
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {};

  return betterAuth({
    appName: options.appName,
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: options.requireEmailVerification ?? false,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          ...resetPasswordEmail({ appName: options.appName, url }),
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          ...verifyEmailTemplate({ appName: options.appName, url }),
        });
      },
    },
    socialProviders: google,
    user: {
      additionalFields: {
        stripeCustomerId: { type: "string", required: false, input: false },
      },
    },
    session: {
      // Avoid a DB hit on every request; cookie is re-validated every 5 minutes.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"]["session"];
export type SessionUser = Auth["$Infer"]["Session"]["user"];

/** Build a lazily-initialised auth instance (safe to import during `next build`). */
export function defineAuth(options: AuthOptions): Auth {
  return lazy(() => createAuth(options));
}

/** Names of social providers that are configured via env. Use to render buttons. */
export function enabledSocialProviders(): Array<"google"> {
  const out: Array<"google"> = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) out.push("google");
  return out;
}

import { defineAuth } from "@kch/auth";
import { appConfig } from "@/app.config";

export const auth = defineAuth({
  appName: appConfig.name,
  requireEmailVerification: appConfig.requireEmailVerification,
  // Personal app: when ALLOWED_EMAILS is set, nobody else can create an account.
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean),
});

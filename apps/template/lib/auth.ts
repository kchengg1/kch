import { defineAuth } from "@kch/auth";
import { appConfig } from "@/app.config";

export const auth = defineAuth({
  appName: appConfig.name,
  requireEmailVerification: appConfig.requireEmailVerification,
});

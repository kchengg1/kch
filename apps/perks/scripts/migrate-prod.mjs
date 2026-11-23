/**
 * Run Drizzle migrations automatically during Vercel production builds.
 * Skipped on local builds and preview deployments so they never touch prod DB.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const vercelEnv = process.env.VERCEL_ENV;
const hasDb = Boolean(process.env.DATABASE_URL);

if (vercelEnv !== "production" || !hasDb) {
  console.log(
    `[migrate-prod] Skipping DB migrations (VERCEL_ENV=${vercelEnv ?? "unset"}, DATABASE_URL=${hasDb ? "set" : "unset"}).`,
  );
  process.exit(0);
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");
console.log("[migrate-prod] Applying Drizzle migrations to production database...");
execFileSync("pnpm", ["--filter", "@kch/db", "migrate"], {
  cwd: repoRoot,
  stdio: "inherit",
});
console.log("[migrate-prod] Migrations complete.");

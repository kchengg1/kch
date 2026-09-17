import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Loads DATABASE_URL from packages/db/.env or the shell. From the repo root:
//   DATABASE_URL=... pnpm db:push
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});

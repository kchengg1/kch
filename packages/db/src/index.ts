import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export * from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  // prepare: false is required for transaction-mode poolers (Supabase, Neon pooled URLs).
  const client = postgres(url, { prepare: false, max: 10 });
  return drizzle(client, { schema });
}

// Reuse the connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __kchDb?: Db };

/**
 * Lazily-created shared Drizzle client. Reads DATABASE_URL at first use so that
 * importing this module (e.g. during `next build`) never throws.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!globalForDb.__kchDb) {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");
      globalForDb.__kchDb = createDb(url);
    }
    const value = Reflect.get(globalForDb.__kchDb, prop);
    return typeof value === "function" ? value.bind(globalForDb.__kchDb) : value;
  },
});

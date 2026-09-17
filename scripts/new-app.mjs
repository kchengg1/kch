#!/usr/bin/env node
/**
 * Scaffold a new app from apps/template.
 *
 *   pnpm new-app <name> [--title "Display Name"]
 *
 * - copies apps/template -> apps/<name>
 * - renames the package to @kch/<name>
 * - sets the app name in app.config.ts
 * - creates .env from .env.example with a fresh BETTER_AUTH_SECRET
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const titleIdx = args.indexOf("--title");
const title = titleIdx >= 0 ? args[titleIdx + 1] : undefined;

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(
    'Usage: pnpm new-app <name> [--title "Display Name"]\n  name must be lowercase, e.g. "invoice-buddy"',
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const src = join(root, "apps", "template");
const dest = join(root, "apps", name);

if (existsSync(dest)) {
  console.error(`apps/${name} already exists`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, {
  recursive: true,
  filter: (p) =>
    !/(^|\/)(node_modules|\.next|\.turbo|\.env|next-env\.d\.ts|tsconfig\.tsbuildinfo)(\/|$)/.test(
      p.replace(src, ""),
    ),
});

const displayName =
  title ??
  name
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

// package.json
const pkgPath = join(dest, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = `@kch/${name}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// app.config.ts
const cfgPath = join(dest, "app.config.ts");
writeFileSync(
  cfgPath,
  readFileSync(cfgPath, "utf8").replace('name: "Template"', `name: ${JSON.stringify(displayName)}`),
);

// README
const readmePath = join(dest, "README.md");
writeFileSync(
  readmePath,
  `# ${displayName}\n\nScaffolded from \`apps/template\`. See \`/docs/NEW_APP.md\`.\n`,
);

// .env with a real secret
const env = readFileSync(join(dest, ".env.example"), "utf8").replace(
  "BETTER_AUTH_SECRET=change-me",
  `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`,
);
writeFileSync(join(dest, ".env"), env);

console.log(`\n✔ Created apps/${name} (${displayName})

Next steps:
  1. pnpm install
  2. Fill in apps/${name}/.env  (DATABASE_URL at minimum)
  3. DATABASE_URL=... pnpm db:push
  4. pnpm --filter @kch/${name} dev
  5. Edit apps/${name}/app.config.ts and build your feature in app/dashboard
`);

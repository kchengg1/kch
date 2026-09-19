import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: [
    "@kch/ui",
    "@kch/auth",
    "@kch/db",
    "@kch/email",
    "@kch/payments",
    "@kch/analytics",
  ],
  serverExternalPackages: ["postgres"],
  typedRoutes: true,
};

export default nextConfig;

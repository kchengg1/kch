import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@kch/ui", "@kch/auth", "@kch/db", "@kch/email", "@kch/analytics"],
  serverExternalPackages: ["postgres", "nodemailer"],
  typedRoutes: true,
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { appConfig } from "@/app.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api", "/q/"] },
    sitemap: `${appConfig.url}/sitemap.xml`,
  };
}

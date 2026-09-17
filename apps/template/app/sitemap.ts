import type { MetadataRoute } from "next";
import { appConfig } from "@/app.config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/pricing", "/legal/privacy", "/legal/terms"].map((path) => ({
    url: `${appConfig.url}${path}`,
    lastModified: new Date(),
  }));
}

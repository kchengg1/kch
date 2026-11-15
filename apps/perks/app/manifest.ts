import type { MetadataRoute } from "next";
import { appConfig } from "@/app.config";

/** Lets phones add Perks to the home screen and open it full screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.name,
    description: appConfig.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fbfbfb",
    theme_color: "#fbfbfb",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

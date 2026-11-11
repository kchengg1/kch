import { appConfig } from "@/app.config";

/** Absolute URL for a path on this app. */
export function absoluteUrl(path: string) {
  return new URL(path, appConfig.url).toString();
}

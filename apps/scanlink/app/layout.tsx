import type { Metadata } from "next";
import { AnalyticsProvider } from "@kch/analytics";
import { appConfig } from "@/app.config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.url),
  title: {
    default: `${appConfig.name} – ${appConfig.tagline}`,
    template: `%s – ${appConfig.name}`,
  },
  description: appConfig.description,
  openGraph: {
    type: "website",
    siteName: appConfig.name,
    title: appConfig.tagline,
    description: appConfig.description,
    url: appConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    ...(appConfig.twitterHandle ? { site: appConfig.twitterHandle } : {}),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}

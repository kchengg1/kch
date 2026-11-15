import type { Metadata, Viewport } from "next";
import { AnalyticsProvider } from "@kch/analytics";
import { appConfig } from "@/app.config";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page run under the iPhone notch and home bar; layouts pad with safe-area insets.
  viewportFit: "cover",
  themeColor: "#fbfbfb",
};

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: appConfig.name, statusBarStyle: "default" },
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

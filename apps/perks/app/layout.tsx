import type { Metadata, Viewport } from "next";
import { AnalyticsProvider } from "@kch/analytics";
import { appConfig } from "@/app.config";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page run under the iPhone notch and home bar; layouts pad with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
  ],
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

/** Applies the saved or system theme before first paint to avoid light/dark flicker. */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('perks-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||(s!=='light'&&m);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground antialiased">
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}

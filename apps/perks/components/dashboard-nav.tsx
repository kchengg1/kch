"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, CreditCard, Gift, LayoutDashboard, Settings, Tag } from "lucide-react";
import { cn } from "@kch/ui";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, also: [] as string[] },
  // Catch up is about recording card usage, so it belongs with Cards.
  { href: "/dashboard/cards", label: "Cards", icon: CreditCard, also: ["/dashboard/catch-up"] },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, also: [] },
  { href: "/dashboard/points", label: "Points", icon: Coins, also: [] },
  { href: "/dashboard/bonuses", label: "Bonuses", icon: Gift, also: [] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, also: [] },
] as const;

/** Whether `pathname` is `base` or a page beneath it. */
const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const isActive = (pathname: string, tab: (typeof TABS)[number]) =>
  tab.href === "/dashboard"
    ? pathname === "/dashboard"
    : within(pathname, tab.href) || tab.also.some((p) => within(pathname, p));

/** Dashboard tabs in the top bar, with the current section highlighted. Hidden on phones. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded px-3 py-2 transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Phone tab bar fixed to the bottom of the screen, like a native app. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-6">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

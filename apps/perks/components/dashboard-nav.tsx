"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, CreditCard, LayoutDashboard, Settings, Tag, Users } from "lucide-react";
import { cn } from "@kch/ui";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, also: ["/dashboard/year-end"] },
  // Catch up, the card picker, and sign-up bonuses & rules all live under Cards.
  {
    href: "/dashboard/cards",
    label: "Cards",
    icon: CreditCard,
    also: ["/dashboard/catch-up", "/dashboard/pick", "/dashboard/bonuses"],
  },
  { href: "/dashboard/offers", label: "Offers", icon: Tag, also: [] as string[] },
  { href: "/dashboard/points", label: "Points", icon: Coins, also: [] as string[] },
  // Group leaderboard, others' cards, and others' offers, read-only.
  { href: "/dashboard/people", label: "People", icon: Users, also: [] as string[] },
] as const;

const CARDS_TABS = [
  { href: "/dashboard/cards", label: "My cards" },
  { href: "/dashboard/pick", label: "Which card?" },
  { href: "/dashboard/bonuses", label: "Bonuses & rules" },
] as const;

/** Whether `pathname` is `base` or a page beneath it. */
const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

const isActive = (pathname: string, tab: (typeof TABS)[number]) =>
  (tab.href === "/dashboard" ? pathname === "/dashboard" : within(pathname, tab.href)) ||
  tab.also.some((p) => within(pathname, p));

/** Dashboard tabs in the top bar, with the current section highlighted. Hidden on phones. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Gear icon in the top header for Settings, highlighted when active. */
export function SettingsLink() {
  const pathname = usePathname();
  const active = within(pathname, "/dashboard/settings");
  return (
    <Link
      href="/dashboard/settings"
      aria-label="Settings"
      title="Settings"
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Settings aria-hidden className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
    </Link>
  );
}

/** Pill switcher shared by My cards, Which card?, and Bonuses & rules. */
export function CardsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Card views" className="flex">
      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border bg-card p-1 text-sm whitespace-nowrap shadow-xs">
        {CARDS_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                active
                  ? "bg-primary font-medium text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Phone tab bar fixed to the bottom of the screen, styled as a floating frosted pill. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:hidden">
      <nav
        aria-label="Sections"
        className="pointer-events-auto mx-auto max-w-md rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur-md"
      >
        <ul className="grid grid-cols-5 gap-0.5">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon
                    aria-hidden
                    className="h-[18px] w-[18px]"
                    strokeWidth={active ? 2.3 : 1.8}
                  />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

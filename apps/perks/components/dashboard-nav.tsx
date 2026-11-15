"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@kch/ui";

const TABS = [
  { href: "/dashboard", label: "Overview", also: [] as string[] },
  // Catch up is about recording card usage, so it belongs with Cards.
  { href: "/dashboard/cards", label: "Cards", also: ["/dashboard/catch-up"] },
  { href: "/dashboard/offers", label: "Offers", also: [] },
  { href: "/dashboard/bonuses", label: "Bonuses", also: [] },
  { href: "/dashboard/settings", label: "Settings", also: [] },
] as const;

/** Whether `pathname` is `base` or a page beneath it. */
const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** Dashboard tabs with the current section highlighted. */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <>
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : within(pathname, tab.href) || tab.also.some((p) => within(pathname, p));
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
    </>
  );
}

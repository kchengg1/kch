import Link from "next/link";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";
import { DashboardNav, MobileTabBar, SettingsLink } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { requireSession } from "@/lib/session";

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  const initials = initialsOf(user.name, user.email);
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <Container className="flex h-14 items-center justify-between gap-3">
          <nav aria-label="Main" className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard"
              className="mr-3 inline-flex shrink-0 items-center gap-2 font-bold tracking-tight"
            >
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground shadow-xs"
              >
                P
              </span>
              <span className="text-base">{appConfig.name}</span>
            </Link>
            <DashboardNav />
          </nav>
          <div className="flex items-center gap-1.5 text-sm">
            <ThemeToggleButton />
            <SettingsLink />
            <span
              title={`${user.name} (${user.email})`}
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary md:inline-flex"
            >
              {initials}
            </span>
            <SignOutButton className="hidden sm:inline-flex" />
          </div>
        </Container>
      </header>
      <main className="flex-1 bg-background">
        {/* Bottom padding keeps content clear of the floating phone tab bar. */}
        <Container className="pt-5 pb-28 sm:py-8">{children}</Container>
      </main>
      <MobileTabBar />
    </>
  );
}

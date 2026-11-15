import Link from "next/link";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";
import { DashboardNav, MobileTabBar } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Container className="flex h-14 items-center justify-between">
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <Link href="/" className="mr-4 shrink-0 font-semibold">
              {appConfig.name}
            </Link>
            <DashboardNav />
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <SignOutButton />
          </div>
        </Container>
      </header>
      <main className="flex-1 bg-muted/40">
        {/* Bottom padding keeps content clear of the phone tab bar. */}
        <Container className="pt-5 pb-28 sm:py-10">{children}</Container>
      </main>
      <MobileTabBar />
    </>
  );
}

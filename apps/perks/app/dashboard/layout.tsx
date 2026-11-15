import Link from "next/link";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";
import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <>
      <header className="border-b">
        <Container className="flex h-14 items-center justify-between">
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
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
        <Container className="py-10">{children}</Container>
      </main>
    </>
  );
}

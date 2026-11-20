import Link from "next/link";
import { Button, Container } from "@kch/ui";
import { appConfig } from "@/app.config";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground shadow-xs"
          >
            P
          </span>
          <span className="text-base">{appConfig.name}</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <ThemeToggleButton />
          {session ? (
            <Link href="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-muted-foreground hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}

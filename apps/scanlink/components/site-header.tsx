import Link from "next/link";
import { Button, Container } from "@kch/ui";
import { appConfig } from "@/app.config";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/" className="font-semibold">
          {appConfig.name}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/pricing" className="px-3 py-2 text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
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

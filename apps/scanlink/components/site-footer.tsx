import Link from "next/link";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t py-8 text-sm text-muted-foreground">
      <Container className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {appConfig.name}
        </p>
        <nav className="flex gap-4">
          <Link href="/pricing">Pricing</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <a href={`mailto:${appConfig.supportEmail}`}>Support</a>
        </nav>
      </Container>
    </footer>
  );
}

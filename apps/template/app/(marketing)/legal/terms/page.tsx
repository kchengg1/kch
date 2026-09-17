import type { Metadata } from "next";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";

export const metadata: Metadata = { title: "Terms of Service" };

// Placeholder. Replace with real terms before launch.
export default function TermsPage() {
  return (
    <Container className="prose max-w-2xl py-16">
      <h1>Terms of Service</h1>
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>
        By using {appConfig.name} you agree to use it lawfully and accept that the service is
        provided as-is. Subscriptions renew automatically until cancelled from your billing page.
      </p>
    </Container>
  );
}

import type { Metadata } from "next";
import { Container } from "@kch/ui";
import { appConfig } from "@/app.config";

export const metadata: Metadata = { title: "Privacy Policy" };

// Placeholder. Replace with a real policy before launch (required by Stripe and Google OAuth).
export default function PrivacyPage() {
  return (
    <Container className="prose max-w-2xl py-16">
      <h1>Privacy Policy</h1>
      <p>Last updated: {new Date().toISOString().slice(0, 10)}</p>
      <p>
        {appConfig.name} stores the account details you give us (name, email) and billing records
        processed by Stripe. We never sell your data. Contact {appConfig.supportEmail} to delete
        your account.
      </p>
    </Container>
  );
}

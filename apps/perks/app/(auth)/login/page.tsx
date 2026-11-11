import type { Metadata } from "next";
import { Suspense } from "react";
import { enabledSocialProviders } from "@kch/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Welcome back</h1>
      <Suspense>
        <AuthForm mode="login" socialProviders={enabledSocialProviders()} />
      </Suspense>
    </>
  );
}

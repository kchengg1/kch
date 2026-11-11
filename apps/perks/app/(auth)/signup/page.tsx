import type { Metadata } from "next";
import { Suspense } from "react";
import { enabledSocialProviders } from "@kch/auth";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Create your account</h1>
      <Suspense>
        <AuthForm mode="signup" socialProviders={enabledSocialProviders()} />
      </Suspense>
    </>
  );
}

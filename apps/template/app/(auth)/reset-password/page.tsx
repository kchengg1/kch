import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}

import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-reset-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm />
    </>
  );
}

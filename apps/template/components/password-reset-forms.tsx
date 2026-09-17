"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@kch/ui";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    if (error) setError(error.message ?? "Could not send reset email");
    else setSent(true);
  }

  if (sent)
    return <Alert variant="success">If that email exists, a reset link is on its way.</Alert>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" className="w-full">
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newPassword = String(new FormData(e.currentTarget).get("password") ?? "");
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) setError(error.message ?? "Could not reset password");
    else setDone(true);
  }

  if (!token) return <Alert variant="error">This reset link is invalid or expired.</Alert>;
  if (done)
    return (
      <Alert variant="success">
        Password updated.{" "}
        <a href="/login" className="underline">
          Log in
        </a>
      </Alert>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" className="w-full">
        Set new password
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Card, CardDescription, CardTitle, Input, Label } from "@kch/ui";
import { createCodeAction } from "@/app/dashboard/codes/actions";

export function CreateCodeForm() {
  const [state, action, pending] = useActionState(createCodeAction, undefined);

  return (
    <Card>
      <CardTitle>New QR code</CardTitle>
      <CardDescription className="mt-1">
        Pick a name and where it should send people. You can change the destination later.
      </CardDescription>
      <form action={action} className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Lunch menu" required maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetUrl">Destination URL</Label>
          <Input
            id="targetUrl"
            name="targetUrl"
            placeholder="example.com/menu"
            required
            inputMode="url"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create code"}
        </Button>
      </form>
      {state?.error && (
        <Alert variant="error" className="mt-4">
          {state.error}{" "}
          {state.upgrade && (
            <Link href="/pricing" className="font-medium underline">
              See plans
            </Link>
          )}
        </Alert>
      )}
    </Card>
  );
}

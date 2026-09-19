"use client";

import { useActionState } from "react";
import { Alert, Button, Input, Label } from "@kch/ui";
import { updateCodeAction } from "@/app/dashboard/codes/actions";

export function EditCodeForm({
  id,
  name,
  targetUrl,
}: {
  id: string;
  name: string;
  targetUrl: string;
}) {
  const [state, action, pending] = useActionState(updateCodeAction, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Destination URL</Label>
        <Input id="targetUrl" name="targetUrl" defaultValue={targetUrl} required inputMode="url" />
        <p className="text-xs text-muted-foreground">
          Changes apply instantly to every printed copy of this code.
        </p>
      </div>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.saved && (
        <Alert variant="success">Saved. The code now points to the new destination.</Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

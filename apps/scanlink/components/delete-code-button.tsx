"use client";

import { Button } from "@kch/ui";
import { deleteCodeAction } from "@/app/dashboard/codes/actions";

export function DeleteCodeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCodeAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${name}"? Printed copies will stop working.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm">
        Delete code
      </Button>
    </form>
  );
}

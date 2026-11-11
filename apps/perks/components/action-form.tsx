"use client";

import { useActionState, type ReactNode } from "react";
import { Alert, Button, type ButtonProps } from "@kch/ui";

type State = { error?: string; message?: string } | undefined;

/** A form bound to a server action that shows the action's error or confirmation. */
export function ActionForm({
  action,
  submit,
  children,
  className,
  variant,
  size,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  submit: string;
  children?: ReactNode;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.message && <Alert variant="success">{state.message}</Alert>}
      <div>
        <Button type="submit" variant={variant} size={size} disabled={pending}>
          {pending ? "Working…" : submit}
        </Button>
      </div>
    </form>
  );
}

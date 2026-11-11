"use client";

import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@kch/ui";
import { authClient } from "@/lib/auth-client";

export function SignOutButton(props: ButtonProps) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      {...props}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

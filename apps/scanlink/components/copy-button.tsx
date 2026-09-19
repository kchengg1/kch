"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@kch/ui";

export function CopyButton({ value, ...props }: { value: string } & ButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      {...props}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

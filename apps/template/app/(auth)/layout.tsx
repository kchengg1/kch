import Link from "next/link";
import { Card } from "@kch/ui";
import { appConfig } from "@/app.config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center font-semibold">
          {appConfig.name}
        </Link>
        <Card>{children}</Card>
      </div>
    </main>
  );
}

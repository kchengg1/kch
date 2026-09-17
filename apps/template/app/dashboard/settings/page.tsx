import { Card, CardDescription, CardTitle } from "@kch/ui";
import { requireSession } from "@/lib/session";

export default async function SettingsPage() {
  const { user } = await requireSession();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardTitle>Account</CardTitle>
        <CardDescription className="mt-1">Signed in as {user.email}</CardDescription>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Verified</dt>
          <dd>{user.emailVerified ? "Yes" : "No"}</dd>
        </dl>
      </Card>
    </div>
  );
}

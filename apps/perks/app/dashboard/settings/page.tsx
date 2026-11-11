import type { Metadata } from "next";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { getSettings } from "@/lib/perks";
import { requireSession } from "@/lib/session";
import { sendDigestNowAction, setDigestAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireSession();
  const settings = await getSettings(user.id);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardTitle className="flex items-center gap-2">
          Email digest
          <Badge variant={settings.digestEnabled ? "success" : "secondary"}>
            {settings.digestEnabled ? "On" : "Off"}
          </Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Every Monday, and again on the 25th, an email to {user.email} lists credits ending within
          three weeks and offers expiring within ten days. Nothing is sent when nothing is due.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <form action={setDigestAction.bind(null, !settings.digestEnabled)}>
            <Button type="submit" variant="outline">
              {settings.digestEnabled ? "Turn off" : "Turn on"}
            </Button>
          </form>
          <ActionForm
            action={sendDigestNowAction}
            submit="Send me one now"
            variant="ghost"
            className="flex flex-col gap-3"
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Account</CardTitle>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
        </dl>
      </Card>
    </div>
  );
}

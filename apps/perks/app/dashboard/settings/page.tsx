import type { Metadata } from "next";
import { Badge, Button, Card, CardDescription, CardTitle } from "@kch/ui";
import { ActionForm } from "@/components/action-form";
import { PushToggle } from "@/components/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeModeSelector } from "@/components/theme-toggle";
import { getLastActiveAt } from "@kch/auth/server";
import { formatLastActive } from "@/lib/last-active";
import { vapidPublicKey } from "@/lib/push";
import { getSettings } from "@/lib/perks";
import { requireSession } from "@/lib/session";
import { sendDigestNowAction, setDigestAction, setShareRankingsAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireSession();
  const [settings, publicKey, lastActiveAt] = await Promise.all([
    getSettings(user.id),
    vapidPublicKey(),
    getLastActiveAt(user.id),
  ]);
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardTitle>Appearance</CardTitle>
        <CardDescription className="mt-1">
          Choose Light, Dark, or match your device&rsquo;s appearance automatically.
        </CardDescription>
        <div className="mt-4">
          <ThemeModeSelector />
        </div>
      </Card>

      <Card>
        <CardTitle>Phone notifications</CardTitle>
        <CardDescription className="mt-1">
          The same reminders as the email digest, as a notification on your phone. Turn it on once
          on each phone or computer. On Android this works in Chrome; on iPhone, add Perks to your
          home screen first. Turning off the email digest below turns these off too.
        </CardDescription>
        <div className="mt-4">
          <PushToggle publicKey={publicKey} />
        </div>
      </Card>

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
        <CardTitle className="flex items-center gap-2">
          Group rankings
          <Badge variant={settings.shareRankings ? "success" : "secondary"}>
            {settings.shareRankings ? "Sharing" : "Hidden"}
          </Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          The People tab and card pages rank you by how much of your cards&rsquo; credits
          you&rsquo;ve used this year, and others can tap your cards to see which credits
          you&rsquo;ve used and which are left. Your points are never shown. Offers you paste are
          visible to the group on the People tab either way.
        </CardDescription>
        <form action={setShareRankingsAction.bind(null, !settings.shareRankings)} className="mt-4">
          <Button type="submit" variant="outline">
            {settings.shareRankings ? "Stop sharing my totals" : "Share my totals"}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Account</CardTitle>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Last active</dt>
          <dd>{formatLastActive(lastActiveAt)}</dd>
        </dl>
        <div className="mt-4 border-t pt-4">
          <SignOutButton variant="outline" />
        </div>
      </Card>
    </div>
  );
}

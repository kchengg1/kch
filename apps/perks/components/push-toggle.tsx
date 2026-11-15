"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button } from "@kch/ui";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/app/dashboard/actions";

type State = "loading" | "unsupported" | "install" | "blocked" | "off" | "on";

/** The VAPID public key, base64url, as the bytes PushManager wants. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Turns phone or browser notifications on and off for this device. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        // iPhone only offers push to sites added to the home screen.
        setState(isIos() && !isInstalled() ? "install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function turnOn() {
    setMessage(null);
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const json = sub.toJSON();
      await savePushSubscriptionAction({
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setState("on");
      setMessage("Notifications are on for this device.");
    });
  }

  function turnOff() {
    setMessage(null);
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  function test() {
    setMessage(null);
    startTransition(async () => {
      const n = await sendTestPushAction();
      setMessage(
        n > 0 ? "Test sent. It should appear in a few seconds." : "No device is signed up yet.",
      );
    });
  }

  if (state === "loading")
    return <p className="text-sm text-muted-foreground">Checking this device…</p>;
  if (state === "install")
    return (
      <Alert>
        On iPhone, notifications only work from the home-screen app. In Safari, tap Share, then Add
        to Home Screen, open Perks from there and come back to this page.
      </Alert>
    );
  if (state === "unsupported")
    return (
      <Alert>
        This browser can&rsquo;t receive notifications. Try Chrome on Android, or the home-screen
        app on iPhone.
      </Alert>
    );
  if (state === "blocked")
    return (
      <Alert>
        Notifications are blocked for this site. Allow them in your browser or phone settings, then
        reload this page.
      </Alert>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <Button onClick={turnOn} disabled={pending}>
            Turn on notifications on this device
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={test} disabled={pending}>
              Send a test
            </Button>
            <Button variant="ghost" onClick={turnOff} disabled={pending}>
              Turn off on this device
            </Button>
          </>
        )}
      </div>
      {message && <Alert variant="success">{message}</Alert>}
    </div>
  );
}

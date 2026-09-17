"use client";

import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";

let initialised = false;

function init() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || initialised || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialised = true;
}

/** Drop this once in the root layout. No-op when NEXT_PUBLIC_POSTHOG_KEY is unset. */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(init, []);
  return <>{children}</>;
}

/** Fire a custom event, e.g. track("checkout_started", { plan: "pro" }). */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialised) return;
  posthog.capture(event, properties);
}

/** Tie events to a signed-in user. Call after login. */
export function identify(userId: string, traits?: Record<string, unknown>) {
  if (!initialised) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics() {
  if (!initialised) return;
  posthog.reset();
}

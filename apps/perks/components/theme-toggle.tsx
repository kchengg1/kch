"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@kch/ui";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "perks-theme";
const THEME_EVENT = "perks-theme-change";

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Ignore storage errors in private browsing.
  }
  return "system";
}

function applyMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

function subscribeTheme(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (readStoredMode() === "system") applyMode("system");
    onStoreChange();
  };
  const onThemeChange = () => {
    applyMode(readStoredMode());
    onStoreChange();
  };
  media.addEventListener("change", onMediaChange);
  window.addEventListener(THEME_EVENT, onThemeChange);
  window.addEventListener("storage", onThemeChange);
  return () => {
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener(THEME_EVENT, onThemeChange);
    window.removeEventListener("storage", onThemeChange);
  };
}

function useThemeMode() {
  const mode = useSyncExternalStore<ThemeMode>(subscribeTheme, readStoredMode, () => "system");

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors.
    }
    applyMode(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return { mode, setMode };
}

/** Compact cycle button in the dashboard top bar (Light → Dark → System). */
export function ThemeToggleButton() {
  const { mode, setMode } = useThemeMode();
  const nextMode: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const label =
    mode === "dark"
      ? "Dark theme (switch to system)"
      : mode === "light"
        ? "Light theme (switch to dark)"
        : "System theme (switch to light)";

  return (
    <button
      type="button"
      onClick={() => setMode(nextMode)}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {mode === "system" ? (
        <Monitor aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      ) : mode === "dark" ? (
        <Moon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      ) : (
        <Sun aria-hidden className="h-4 w-4" strokeWidth={1.9} />
      )}
    </button>
  );
}

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Full segmented Appearance control shown on the Settings page. */
export function ThemeModeSelector() {
  const { mode, setMode } = useThemeMode();
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-flex rounded-[var(--radius)] border bg-muted/70 p-1 text-sm"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3.5 py-1.5 font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

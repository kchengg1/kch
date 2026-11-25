import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { getStoredThemeMode, setStoredThemeMode, type StoredThemeMode } from "./storage";
import { getCachedThemedStyles } from "./theme-cache";

export type ThemeMode = StoredThemeMode;

export type ThemeColors = {
  bg: string;
  card: string;
  subtle: string;
  border: string;
  borderStrong: string;
  ink: string;
  muted: string;
  faint: string;
  primary: string;
  primaryInk: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  heroBg: string;
  heroAccentBg: string;
  heroSurface: string;
  heroInk: string;
  heroMuted: string;
  heroGold: string;
  greenBg: string;
  greenBorder: string;
  greenInk: string;
  greenFill: string;
  amberBg: string;
  amberBorder: string;
  amberInk: string;
  amberFill: string;
  redBg: string;
  redBorder: string;
  redInk: string;
  redFill: string;
};

/** Sapphire Concierge — Light (Airy ceramic, deep sapphire navy, concierge teal & warm amber). */
export const LIGHT_COLORS: ThemeColors = {
  bg: "#f2f5fa",
  card: "#ffffff",
  subtle: "#e8eef7",
  border: "#dce4f0",
  borderStrong: "#c2d0e6",
  ink: "#0f1f3d",
  muted: "#506484",
  faint: "#8697b2",
  primary: "#1e3a8a",
  primaryInk: "#f8faff",
  primarySoft: "rgba(30, 58, 138, 0.10)",
  accent: "#d97706",
  accentSoft: "rgba(217, 119, 6, 0.12)",
  heroBg: "#162d66",
  heroAccentBg: "#1e3a8a",
  heroSurface: "rgba(255, 255, 255, 0.13)",
  heroInk: "#f8faff",
  heroMuted: "rgba(248, 250, 255, 0.76)",
  heroGold: "#fcd34d",
  greenBg: "#ccfbf1",
  greenBorder: "#99f6e4",
  greenInk: "#115e59",
  greenFill: "#0d9488",
  amberBg: "#fef3c7",
  amberBorder: "#fde68a",
  amberInk: "#92400e",
  amberFill: "#d97706",
  redBg: "#ffe4e6",
  redBorder: "#fecdd3",
  redInk: "#9f1239",
  redFill: "#e11d48",
};

/** Sapphire Concierge — Dark (Midnight sapphire, elevated navy surfaces, luminous sky & teal). */
export const DARK_COLORS: ThemeColors = {
  bg: "#0a1020",
  card: "#111a30",
  subtle: "#192542",
  border: "#223154",
  borderStrong: "#314573",
  ink: "#f0f5ff",
  muted: "#93a6cc",
  faint: "#6276a0",
  primary: "#60a5fa",
  primaryInk: "#071226",
  primarySoft: "rgba(96, 165, 250, 0.16)",
  accent: "#fbbf24",
  accentSoft: "rgba(251, 191, 36, 0.15)",
  heroBg: "#13254d",
  heroAccentBg: "#1b3670",
  heroSurface: "rgba(255, 255, 255, 0.10)",
  heroInk: "#f0f5ff",
  heroMuted: "rgba(240, 245, 255, 0.74)",
  heroGold: "#fcd34d",
  greenBg: "rgba(45, 212, 191, 0.15)",
  greenBorder: "rgba(45, 212, 191, 0.34)",
  greenInk: "#5eead4",
  greenFill: "#2dd4bf",
  amberBg: "rgba(251, 191, 36, 0.15)",
  amberBorder: "rgba(251, 191, 36, 0.32)",
  amberInk: "#fde68a",
  amberFill: "#fbbf24",
  redBg: "rgba(251, 113, 133, 0.16)",
  redBorder: "rgba(251, 113, 133, 0.34)",
  redInk: "#fda4af",
  redFill: "#fb7185",
};

export function isLightHex(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  isDark: false,
  colors: LIGHT_COLORS,
  setMode: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let mounted = true;
    void getStoredThemeMode().then((saved) => {
      if (mounted) setModeState(saved);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void setStoredThemeMode(next);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemScheme === "dark");
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);

  const value = useMemo(() => ({ mode, isDark, colors, setMode }), [mode, isDark, colors, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return getCachedThemedStyles(colors, factory);
}

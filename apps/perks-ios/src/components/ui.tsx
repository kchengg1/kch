import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { CardStyle, TabKey } from "../types";
import { tapHaptic } from "../lib/haptics";

export const COLORS = {
  bg: "#fbfbfb",
  card: "#ffffff",
  subtle: "#f4f4f5",
  border: "#e4e4e7",
  borderStrong: "#d4d4d8",
  ink: "#111111",
  muted: "#666666",
  faint: "#999999",
  greenBg: "#ecfdf5",
  greenBorder: "#bbf7d0",
  greenInk: "#166534",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  amberInk: "#92400e",
  redBg: "#fef2f2",
  redBorder: "#fecaca",
  redInk: "#991b1b",
};

export const NUM_STYLE: TextStyle = {
  fontVariant: ["tabular-nums"],
};

export function CardSwatch({
  style: cardStyle,
  size = "sm",
}: {
  style: CardStyle;
  size?: "sm" | "md";
}) {
  const width = size === "md" ? 44 : 32;
  const height = size === "md" ? 28 : 20;
  const chipColor = cardStyle.chip === "gold" ? "#e5c16c" : "#d4d8dd";

  return (
    <View
      style={[
        styles.swatch,
        {
          width,
          height,
          backgroundColor: cardStyle.from,
          borderColor: cardStyle.to,
        },
      ]}
    >
      <View
        style={[
          styles.swatchShade,
          {
            backgroundColor: cardStyle.to,
            height: Math.round(height * 0.48),
          },
        ]}
      />
      <View
        style={[
          styles.swatchChip,
          {
            backgroundColor: chipColor,
            width: size === "md" ? 8 : 6,
            height: size === "md" ? 6 : 5,
            left: size === "md" ? 6 : 4,
            top: size === "md" ? 7 : 5,
          },
        ]}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const palette =
    tone === "green"
      ? { bg: COLORS.greenBg, border: COLORS.greenBorder, ink: COLORS.greenInk }
      : tone === "amber"
        ? { bg: COLORS.amberBg, border: COLORS.amberBorder, ink: COLORS.amberInk }
        : tone === "red"
          ? { bg: COLORS.redBg, border: COLORS.redBorder, ink: COLORS.redInk }
          : { bg: COLORS.subtle, border: COLORS.border, ink: COLORS.muted };

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.badgeText, { color: palette.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.buttonBase,
        size === "sm" ? styles.buttonSm : styles.buttonMd,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary" ? "#ffffff" : variant === "danger" ? COLORS.redInk : COLORS.ink
          }
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            size === "sm" && styles.buttonTextSm,
            variant === "primary" && styles.buttonTextPrimary,
            variant === "secondary" && styles.buttonTextSecondary,
            variant === "ghost" && styles.buttonTextGhost,
            variant === "danger" && styles.buttonTextDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Meter({
  value,
  max,
  tone = "dark",
}: {
  value: number;
  max: number;
  tone?: "dark" | "green" | "amber";
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fill = tone === "green" ? "#16a34a" : tone === "amber" ? "#d97706" : COLORS.ink;
  return (
    <View style={styles.meterTrack}>
      <View
        style={[styles.meterFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill }]}
      />
    </View>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export function CollapsibleSection({
  title,
  countLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  countLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.collapsibleWrap}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHaptic();
          setOpen((v) => !v);
        }}
        style={styles.collapsibleHeader}
      >
        <Text style={styles.collapsibleTitle}>{title}</Text>
        <View style={styles.collapsibleRight}>
          {countLabel ? <Text style={styles.collapsibleCount}>{countLabel}</Text> : null}
          <Text style={styles.collapsibleChevron}>{open ? "Hide" : "Show"}</Text>
        </View>
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

export function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "sentences",
  secureTextEntry = false,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const TABS: { key: TabKey; label: string; mark: string }[] = [
  { key: "overview", label: "Overview", mark: "◎" },
  { key: "cards", label: "Cards", mark: "▭" },
  { key: "offers", label: "Offers", mark: "✦" },
  { key: "points", label: "Points", mark: "◈" },
  { key: "bonuses", label: "Bonuses", mark: "★" },
];

export function TabBar({
  active,
  onChange,
  bottomInset,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  bottomInset: number;
}) {
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map((t) => {
        const selected = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              tapHaptic();
              onChange(t.key);
            }}
            style={styles.tabItem}
          >
            <Text style={[styles.tabMark, selected && styles.tabMarkSelected]}>{t.mark}</Text>
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: {
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  swatchShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.72,
  },
  swatchChip: {
    position: "absolute",
    borderRadius: 1.5,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  buttonBase: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonSm: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonMd: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonPrimary: {
    backgroundColor: COLORS.ink,
  },
  buttonSecondary: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonDanger: {
    backgroundColor: COLORS.redBg,
    borderWidth: 1,
    borderColor: COLORS.redBorder,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  buttonTextSm: {
    fontSize: 13,
  },
  buttonTextPrimary: {
    color: "#ffffff",
  },
  buttonTextSecondary: {
    color: COLORS.ink,
  },
  buttonTextGhost: {
    color: COLORS.muted,
  },
  buttonTextDanger: {
    color: COLORS.redInk,
  },
  meterTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.subtle,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  collapsibleWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: "hidden",
  },
  collapsibleHeader: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.ink,
    flex: 1,
  },
  collapsibleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  collapsibleCount: {
    fontSize: 13,
    color: COLORS.muted,
    fontVariant: ["tabular-nums"],
  },
  collapsibleChevron: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  collapsibleBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  fieldWrap: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.muted,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: COLORS.ink,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.muted,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tabMark: {
    fontSize: 15,
    color: COLORS.faint,
  },
  tabMarkSelected: {
    color: COLORS.ink,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: COLORS.muted,
  },
  tabLabelSelected: {
    color: COLORS.ink,
    fontWeight: "700",
  },
});

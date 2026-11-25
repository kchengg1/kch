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
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { CardStyle, TabKey } from "../types";
import { tapHaptic } from "../lib/haptics";
import {
  isLightHex,
  LIGHT_COLORS,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../lib/theme";

export {
  isLightHex,
  useTheme,
  useThemedStyles,
  type ThemeColors,
  type ThemeMode,
} from "../lib/theme";

/** Default light palette export preserved for static references; prefer `useTheme()` in components. */
export const COLORS = LIGHT_COLORS;

export const NUM_STYLE: TextStyle = {
  fontVariant: ["tabular-nums"],
};

export const CardSwatch = React.memo(function CardSwatch({
  style: cardStyle,
  size = "sm",
}: {
  style: CardStyle;
  size?: "sm" | "md";
}) {
  const width = size === "md" ? 44 : 32;
  const height = size === "md" ? 28 : 20;
  const chipColor = cardStyle.chip.startsWith("#")
    ? cardStyle.chip
    : cardStyle.chip === "gold"
      ? "#e5c16c"
      : "#d4d8dd";

  return (
    <View
      style={[
        staticStyles.swatch,
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
          staticStyles.swatchShade,
          {
            backgroundColor: cardStyle.to,
            height: Math.round(height * 0.48),
          },
        ]}
      />
      <View
        style={[
          staticStyles.swatchChip,
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
});

/** Tactile metallic card face header used in the iOS Cards Wallet screen. */
export const CardWalletHeader = React.memo(function CardWalletHeader({
  cardStyle,
  issuer,
  name,
  feeLabel,
  closed = false,
}: {
  cardStyle: CardStyle;
  issuer: string;
  name: string;
  feeLabel: string;
  closed?: boolean;
}) {
  const lightFace = isLightHex(cardStyle.from);
  const ink = lightFace ? "#141a24" : "#f8fafc";
  const subInk = lightFace ? "rgba(20, 26, 36, 0.7)" : "rgba(248, 250, 252, 0.75)";
  const chipColor = cardStyle.chip.startsWith("#")
    ? cardStyle.chip
    : cardStyle.chip === "gold"
      ? "#e5c16c"
      : "#d4d8dd";

  return (
    <View
      style={[
        staticStyles.walletFace,
        { backgroundColor: cardStyle.from, opacity: closed ? 0.55 : 1 },
      ]}
    >
      <View style={[staticStyles.walletFaceShade, { backgroundColor: cardStyle.to }]} />
      <View style={staticStyles.walletFaceTop}>
        <View style={staticStyles.walletIdentity}>
          <View style={[staticStyles.walletChip, { backgroundColor: chipColor }]} />
          <View style={staticStyles.walletTextBlock}>
            <Text style={[staticStyles.walletIssuer, { color: subInk }]} numberOfLines={1}>
              {issuer.toUpperCase()}
            </Text>
            <Text style={[staticStyles.walletName, { color: ink }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
        <View style={staticStyles.walletFeePill}>
          <Text style={[staticStyles.walletFeeText, NUM_STYLE]}>{feeLabel}</Text>
        </View>
      </View>
    </View>
  );
});

export const Badge = React.memo(function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const { colors } = useTheme();
  const palette =
    tone === "green"
      ? { bg: colors.greenBg, border: colors.greenBorder, ink: colors.greenInk }
      : tone === "amber"
        ? { bg: colors.amberBg, border: colors.amberBorder, ink: colors.amberInk }
        : tone === "red"
          ? { bg: colors.redBg, border: colors.redBorder, ink: colors.redInk }
          : { bg: colors.subtle, border: colors.border, ink: colors.muted };

  return (
    <View
      style={[staticStyles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[staticStyles.badgeText, { color: palette.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            variant === "primary"
              ? colors.primaryInk
              : variant === "danger"
                ? colors.redInk
                : colors.ink
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

export const Meter = React.memo(function Meter({
  value,
  max,
  marker,
  tone = "dark",
}: {
  value: number;
  max: number;
  /** Optional threshold position (e.g. annual fee in cents) drawn as a vertical tick. */
  marker?: number;
  tone?: "dark" | "green" | "amber";
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const markerPct =
    marker !== undefined && marker > 0 && max > 0 && marker <= max
      ? Math.min(99, Math.max(1, Math.round((marker / max) * 100)))
      : null;
  const fill =
    tone === "green" ? colors.greenFill : tone === "amber" ? colors.amberFill : colors.primary;
  return (
    <View style={styles.meterTrack}>
      <View
        style={[styles.meterFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fill }]}
      />
      {markerPct !== null ? (
        <View
          pointerEvents="none"
          style={[styles.meterMarker, { left: `${markerPct}%`, backgroundColor: colors.ink }]}
        />
      ) : null}
    </View>
  );
});

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
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
  children: React.ReactNode | (() => React.ReactNode);
}) {
  const styles = useThemedStyles(makeStyles);
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
      {open ? (
        <View style={styles.collapsibleBody}>
          {typeof children === "function" ? children() : children}
        </View>
      ) : null}
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
  textContentType,
  autoComplete,
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
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
  hint?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textContentType={textContentType}
        autoComplete={autoComplete}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function SegmentedBar<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (next: K) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmentWrap}>
      {options.map((opt) => {
        const active = opt.key === value;
        const activate = () => {
          if (!active) {
            tapHaptic();
            onChange(opt.key);
          }
        };
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPressIn={activate}
            onPress={activate}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text
              style={[styles.segmentLabel, active && styles.segmentLabelActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Crisp pure-View geometric Face ID glyph (zero native icon dependencies). */
export function FaceIdIcon({ size = 26, color }: { size?: number; color: string }) {
  const stroke = Math.max(2, Math.round(size * 0.085));
  const corner = Math.round(size * 0.27);
  const cornerRadius = Math.max(3, Math.round(size * 0.14));
  const eyeW = stroke;
  const eyeH = Math.max(3, Math.round(size * 0.14));
  const eyeTop = Math.round(size * 0.27);
  const eyeInset = Math.round(size * 0.27);
  const noseW = stroke;
  const noseH = Math.max(4, Math.round(size * 0.19));
  const smileW = Math.round(size * 0.34);
  const smileH = Math.round(size * 0.15);

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: corner,
          height: corner,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderTopLeftRadius: cornerRadius,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: corner,
          height: corner,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderTopRightRadius: cornerRadius,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: corner,
          height: corner,
          borderBottomWidth: stroke,
          borderLeftWidth: stroke,
          borderBottomLeftRadius: cornerRadius,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: corner,
          height: corner,
          borderBottomWidth: stroke,
          borderRightWidth: stroke,
          borderBottomRightRadius: cornerRadius,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: eyeTop,
          left: eyeInset,
          width: eyeW,
          height: eyeH,
          borderRadius: eyeW,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: eyeTop,
          right: eyeInset,
          width: eyeW,
          height: eyeH,
          borderRadius: eyeW,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: Math.round(size * 0.34),
          left: Math.round((size - noseW) / 2),
          width: noseW,
          height: noseH,
          borderRadius: noseW,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: Math.round(size * 0.24),
          left: Math.round((size - smileW) / 2),
          width: smileW,
          height: smileH,
          borderBottomWidth: stroke,
          borderLeftWidth: stroke * 0.6,
          borderRightWidth: stroke * 0.6,
          borderBottomLeftRadius: smileW,
          borderBottomRightRadius: smileW,
          borderColor: color,
        }}
      />
    </View>
  );
}

/** Crisp pure-View geometric icons for the bottom tab bar (zero native icon dependencies). */
function TabGlyph({ tab, color }: { tab: TabKey; color: string }) {
  if (tab === "overview") {
    return (
      <View style={staticStyles.iconBox}>
        <View style={staticStyles.gridRow}>
          <View style={[staticStyles.gridCell, { borderColor: color }]} />
          <View style={[staticStyles.gridCell, { borderColor: color }]} />
        </View>
        <View style={staticStyles.gridRow}>
          <View style={[staticStyles.gridCell, { borderColor: color }]} />
          <View style={[staticStyles.gridCell, { borderColor: color }]} />
        </View>
      </View>
    );
  }
  if (tab === "cards") {
    return (
      <View style={staticStyles.iconBox}>
        <View style={[staticStyles.cardGlyph, { borderColor: color }]}>
          <View style={[staticStyles.cardStripe, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }
  if (tab === "offers") {
    return (
      <View style={staticStyles.iconBox}>
        <View style={[staticStyles.tagDiamond, { borderColor: color }]}>
          <View style={[staticStyles.tagDot, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }
  if (tab === "points") {
    return (
      <View style={staticStyles.iconBox}>
        <View style={[staticStyles.coinOuter, { borderColor: color }]}>
          <View style={[staticStyles.coinInner, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={staticStyles.iconBox}>
      <View style={[staticStyles.personHead, { borderColor: color }]} />
      <View style={[staticStyles.personBody, { borderColor: color }]} />
    </View>
  );
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "cards", label: "Cards" },
  { key: "offers", label: "Offers" },
  { key: "points", label: "Points" },
  { key: "people", label: "People" },
];

export const TabBar = React.memo(function TabBar({
  active,
  onChange,
  bottomInset,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  bottomInset: number;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.tabBarOuter, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const selected = t.key === active;
          const color = selected ? colors.primary : colors.faint;
          const activate = () => {
            if (!selected) {
              tapHaptic();
              onChange(t.key);
            }
          };
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPressIn={activate}
              onPress={activate}
              style={[styles.tabItem, selected && styles.tabItemSelected]}
            >
              <TabGlyph tab={t.key} color={color} />
              <Text
                style={[styles.tabLabel, selected && styles.tabLabelSelected]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const staticStyles = StyleSheet.create({
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
  walletFace: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    position: "relative",
    overflow: "hidden",
  },
  walletFaceShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "54%",
    opacity: 0.55,
  },
  walletFaceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  walletIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  walletChip: {
    width: 26,
    height: 18,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.22)",
    flexShrink: 0,
  },
  walletTextBlock: {
    flex: 1,
  },
  walletIssuer: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  walletName: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  walletFeePill: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  walletFeeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
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
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  iconBox: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  gridRow: {
    flexDirection: "row",
    gap: 2.5,
    marginVertical: 1.25,
  },
  gridCell: {
    width: 6.5,
    height: 6.5,
    borderRadius: 1.8,
    borderWidth: 1.7,
  },
  cardGlyph: {
    width: 17,
    height: 12,
    borderRadius: 2.5,
    borderWidth: 1.7,
    overflow: "hidden",
    justifyContent: "flex-start",
  },
  cardStripe: {
    height: 2.5,
    marginTop: 2.5,
    width: "100%",
  },
  tagDiamond: {
    width: 12,
    height: 12,
    borderRadius: 2.5,
    borderWidth: 1.7,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  tagDot: {
    width: 3,
    height: 3,
    borderRadius: 99,
  },
  coinOuter: {
    width: 15,
    height: 15,
    borderRadius: 99,
    borderWidth: 1.7,
    alignItems: "center",
    justifyContent: "center",
  },
  coinInner: {
    width: 5,
    height: 5,
    borderRadius: 99,
  },
  personHead: {
    width: 6.5,
    height: 6.5,
    borderRadius: 99,
    borderWidth: 1.7,
    marginBottom: 1.5,
  },
  personBody: {
    width: 13,
    height: 6.5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1.7,
    borderBottomWidth: 0,
  },
});

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    buttonBase: {
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    buttonSm: {
      minHeight: 38,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    buttonMd: {
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    buttonPrimary: {
      backgroundColor: COLORS.primary,
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
      color: COLORS.primaryInk,
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
      position: "relative",
      height: 7,
      borderRadius: 999,
      backgroundColor: COLORS.subtle,
      overflow: "hidden",
    },
    meterFill: {
      height: "100%",
      borderRadius: 999,
    },
    meterMarker: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 2,
      opacity: 0.55,
      marginLeft: -1,
    },
    sectionCard: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },
    collapsibleWrap: {
      borderRadius: 16,
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
      color: COLORS.primary,
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
      borderRadius: 11,
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
    segmentWrap: {
      flexDirection: "row",
      backgroundColor: COLORS.subtle,
      borderRadius: 12,
      padding: 3,
      gap: 2,
    },
    segmentBtn: {
      flex: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9,
      paddingHorizontal: 8,
    },
    segmentBtnActive: {
      backgroundColor: COLORS.primary,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.muted,
    },
    segmentLabelActive: {
      color: COLORS.primaryInk,
    },
    tabBarOuter: {
      paddingHorizontal: 12,
      paddingTop: 6,
      backgroundColor: COLORS.bg,
    },
    tabBar: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 5,
      gap: 2,
      shadowColor: "#0f1f3d",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    tabItem: {
      flex: 1,
      minHeight: 46,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 4,
    },
    tabItemSelected: {
      backgroundColor: COLORS.primarySoft,
    },
    tabLabel: {
      fontSize: 10.5,
      fontWeight: "600",
      color: COLORS.faint,
    },
    tabLabelSelected: {
      color: COLORS.primary,
      fontWeight: "700",
    },
  });

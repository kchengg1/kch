import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, COLORS, TabBar } from "./src/components/ui";
import {
  ApiError,
  fetchBootstrap,
  postMobileAction,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
} from "./src/lib/api";
import { successHaptic } from "./src/lib/haptics";
import {
  getDefaultServerUrl,
  getStoredServerUrl,
  getStoredToken,
  setStoredServerUrl,
  setStoredToken,
} from "./src/lib/storage";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BonusesScreen } from "./src/screens/BonusesScreen";
import { CardDetailModal } from "./src/screens/CardDetailModal";
import { CardsScreen } from "./src/screens/CardsScreen";
import { CatchUpModal } from "./src/screens/CatchUpModal";
import { OffersScreen } from "./src/screens/OffersScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PointsScreen } from "./src/screens/PointsScreen";
import { SettingsModal } from "./src/screens/SettingsModal";
import type {
  MobileActionPayload,
  MobileActionResponse,
  MobileBootstrap,
  TabKey,
} from "./src/types";

function PerksShell() {
  const insets = useSafeAreaInsets();
  const [initializing, setInitializing] = useState(true);
  const [serverUrl, setServerUrl] = useState<string>(getDefaultServerUrl());
  const [token, setToken] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const serverRef = useRef<string>(serverUrl);
  tokenRef.current = token;
  serverRef.current = serverUrl;

  const loadSnapshot = useCallback(async (baseUrl: string, authToken: string) => {
    const snap = await fetchBootstrap({ baseUrl, token: authToken });
    setBootstrap(snap);
    setBootError(null);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedUrl, savedToken] = await Promise.all([getStoredServerUrl(), getStoredToken()]);
        if (!active) return;
        setServerUrl(savedUrl);
        if (savedToken) {
          setToken(savedToken);
          try {
            await loadSnapshot(savedUrl, savedToken);
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              await setStoredToken(null);
              if (active) setToken(null);
            } else if (active) {
              setBootError(err instanceof Error ? err.message : "Could not reach server.");
            }
          }
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadSnapshot]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && tokenRef.current) {
        void loadSnapshot(serverRef.current, tokenRef.current).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [loadSnapshot]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    try {
      await loadSnapshot(serverUrl, token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await setStoredToken(null);
        setToken(null);
        setBootstrap(null);
      } else {
        setBanner({
          text: err instanceof Error ? err.message : "Could not refresh.",
          tone: "error",
        });
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRunRawAction(
    payload: MobileActionPayload,
    key: string,
  ): Promise<MobileActionResponse> {
    if (!token) {
      throw new Error("Not signed in.");
    }
    setBusyKey(key);
    setBanner(null);
    try {
      const res = await postMobileAction({ baseUrl: serverUrl, token, payload });
      if (res.bootstrap) {
        setBootstrap(res.bootstrap);
      }
      if (res.message) {
        setBanner({ text: res.message, tone: "info" });
      }
      successHaptic();
      return res;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await setStoredToken(null);
        setToken(null);
        setBootstrap(null);
      } else {
        setBanner({
          text: err instanceof Error ? err.message : "Could not save change.",
          tone: "error",
        });
      }
      throw err;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAction(payload: MobileActionPayload, key: string): Promise<void> {
    try {
      await handleRunRawAction(payload, key);
    } catch {
      // Error surfaced via banner
    }
  }

  async function handleActionReturningCardId(
    payload: MobileActionPayload,
    key: string,
  ): Promise<string | undefined> {
    try {
      const res = await handleRunRawAction(payload, key);
      return res.cardId;
    } catch {
      return undefined;
    }
  }

  async function handleSignOut() {
    const activeToken = token;
    setSettingsOpen(false);
    setSelectedCardId(null);
    setCatchUpOpen(false);
    await setStoredToken(null);
    setToken(null);
    setBootstrap(null);
    if (activeToken) {
      await signOutSession({ baseUrl: serverUrl, token: activeToken });
    }
  }

  if (initializing) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.ink} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <AuthScreen
          initialServerUrl={serverUrl}
          defaultServerUrl={getDefaultServerUrl()}
          onSaveServerUrl={async (nextUrl) => {
            const saved = await setStoredServerUrl(nextUrl);
            setServerUrl(saved);
            return saved;
          }}
          onSignIn={async (email, password, chosenUrl) => {
            const { token: newToken } = await signInWithEmail({
              baseUrl: chosenUrl,
              email,
              password,
            });
            await setStoredToken(newToken);
            setServerUrl(chosenUrl);
            setToken(newToken);
            await loadSnapshot(chosenUrl, newToken);
          }}
          onSignUp={async (name, email, password, chosenUrl) => {
            const { token: newToken } = await signUpWithEmail({
              baseUrl: chosenUrl,
              name,
              email,
              password,
            });
            await setStoredToken(newToken);
            setServerUrl(chosenUrl);
            setToken(newToken);
            await loadSnapshot(chosenUrl, newToken);
          }}
        />
      </View>
    );
  }

  if (!bootstrap) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        {bootError ? (
          <>
            <Text style={styles.errorHeading}>Could not connect to Perks</Text>
            <Text style={styles.errorDetail}>{bootError}</Text>
            <View style={styles.retryRow}>
              <Button label="Retry" onPress={() => void handleRefresh()} loading={refreshing} />
              <Button label="Sign out" variant="secondary" onPress={() => void handleSignOut()} />
            </View>
          </>
        ) : (
          <ActivityIndicator size="large" color={COLORS.ink} />
        )}
      </View>
    );
  }

  const selectedCard = selectedCardId
    ? (bootstrap.cards.find((c) => c.id === selectedCardId) ?? null)
    : null;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {banner ? (
        <Pressable
          onPress={() => setBanner(null)}
          style={[styles.banner, banner.tone === "error" ? styles.bannerError : styles.bannerInfo]}
        >
          <Text
            style={[
              styles.bannerText,
              banner.tone === "error" ? styles.bannerTextError : styles.bannerTextInfo,
            ]}
          >
            {banner.text}
          </Text>
          <Text style={styles.bannerDismiss}>✕</Text>
        </Pressable>
      ) : null}

      <View style={styles.flex}>
        {activeTab === "overview" ? (
          <OverviewScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={() => void handleRefresh()}
            onAction={handleAction}
            onOpenCard={(cardId) => setSelectedCardId(cardId)}
            onOpenCatchUp={() => setCatchUpOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onNavigateTab={setActiveTab}
          />
        ) : null}

        {activeTab === "cards" ? (
          <CardsScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={() => void handleRefresh()}
            onAction={handleActionReturningCardId}
            onOpenCard={(cardId) => setSelectedCardId(cardId)}
            onOpenCatchUp={() => setCatchUpOpen(true)}
          />
        ) : null}

        {activeTab === "offers" ? (
          <OffersScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={() => void handleRefresh()}
            onAction={handleAction}
          />
        ) : null}

        {activeTab === "points" ? (
          <PointsScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={() => void handleRefresh()}
            onAction={handleAction}
          />
        ) : null}

        {activeTab === "bonuses" ? (
          <BonusesScreen
            data={bootstrap}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        ) : null}
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} bottomInset={insets.bottom} />

      <CardDetailModal
        card={selectedCard}
        today={bootstrap.today}
        catalog={bootstrap.catalog}
        busyKey={busyKey}
        onClose={() => setSelectedCardId(null)}
        onAction={handleAction}
      />

      <CatchUpModal
        visible={catchUpOpen}
        data={bootstrap}
        busyKey={busyKey}
        onClose={() => setCatchUpOpen(false)}
        onRunRawAction={handleRunRawAction}
      />

      <SettingsModal
        visible={settingsOpen}
        data={bootstrap}
        serverUrl={serverUrl}
        busyKey={busyKey}
        onClose={() => setSettingsOpen(false)}
        onRunRawAction={handleRunRawAction}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <PerksShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.ink,
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  retryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bannerInfo: {
    backgroundColor: COLORS.greenBg,
    borderColor: COLORS.greenBorder,
  },
  bannerError: {
    backgroundColor: COLORS.redBg,
    borderColor: COLORS.redBorder,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  bannerTextInfo: {
    color: COLORS.greenInk,
  },
  bannerTextError: {
    color: COLORS.redInk,
  },
  bannerDismiss: {
    fontSize: 13,
    color: COLORS.muted,
    paddingHorizontal: 4,
  },
});

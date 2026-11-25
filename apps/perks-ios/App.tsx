import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, TabBar, useTheme, useThemedStyles, type ThemeColors } from "./src/components/ui";
import { ThemeProvider } from "./src/lib/theme";
import {
  ApiError,
  fetchBootstrap,
  postMobileAction,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
} from "./src/lib/api";
import {
  clearBiometricCredentials,
  disableBiometricLock,
  enableBiometricLock,
  getBiometricLabel,
  getBiometricLockEnabled,
  getBiometricMeta,
  isBiometricSupported,
  readBiometricCredentials,
  saveBiometricCredentials,
  shouldLockOnAppStateChange,
  unlockWithBiometrics,
  type BiometricCredentialsMeta,
  type BiometricReadResult,
  type BiometricSignInOutcome,
} from "./src/lib/biometrics";
import { successHaptic } from "./src/lib/haptics";
import {
  getDefaultServerUrl,
  getStoredServerUrl,
  getStoredToken,
  setStoredServerUrl,
  setStoredToken,
} from "./src/lib/storage";
import { AuthScreen } from "./src/screens/AuthScreen";
import { BiometricLockScreen } from "./src/screens/BiometricLockScreen";
import { CardDetailModal } from "./src/screens/CardDetailModal";
import { CardsScreen } from "./src/screens/CardsScreen";
import { CatchUpModal } from "./src/screens/CatchUpModal";
import { OffersScreen } from "./src/screens/OffersScreen";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PeopleScreen } from "./src/screens/PeopleScreen";
import { PointsScreen } from "./src/screens/PointsScreen";
import { SettingsModal } from "./src/screens/SettingsModal";
import { YearEndModal } from "./src/screens/YearEndModal";
import type {
  CardsSubTabKey,
  MobileActionPayload,
  MobileActionResponse,
  MobileBootstrap,
  TabKey,
} from "./src/types";

const INITIAL_MOUNTED_TABS: Record<TabKey, boolean> = {
  overview: true,
  cards: false,
  offers: false,
  points: false,
  people: false,
};

function TabPane({
  active,
  mounted,
  children,
}: {
  active: boolean;
  mounted: boolean;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!mounted && !active) return null;
  return (
    <View
      style={active ? styles.tabPaneActive : styles.tabPaneHidden}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      {children}
    </View>
  );
}

function PerksShell() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [initializing, setInitializing] = useState(true);
  const [serverUrl, setServerUrl] = useState<string>(getDefaultServerUrl());
  const [token, setToken] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const [biometricsSupported, setBiometricsSupported] = useState<boolean>(() =>
    isBiometricSupported(),
  );
  const [biometricMeta, setBiometricMeta] = useState<BiometricCredentialsMeta | null>(null);
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [autoPromptBiometrics, setAutoPromptBiometrics] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [cardsSubTab, setCardsSubTab] = useState<CardsSubTabKey>("cards");
  const [shareTemplateKey, setShareTemplateKey] = useState<string | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Record<TabKey, boolean>>(INITIAL_MOUNTED_TABS);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [catchUpCardId, setCatchUpCardId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [yearEndOpen, setYearEndOpen] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const serverRef = useRef<string>(serverUrl);
  const biometricMetaRef = useRef<BiometricCredentialsMeta | null>(null);
  const biometricLockEnabledRef = useRef(false);
  const appLockedRef = useRef(false);
  const biometricPromptInFlightRef = useRef(false);

  tokenRef.current = token;
  serverRef.current = serverUrl;
  biometricMetaRef.current = biometricMeta;
  biometricLockEnabledRef.current = biometricLockEnabled;
  appLockedRef.current = appLocked;

  const handleTabChange = useCallback((nextTab: TabKey) => {
    setActiveTab(nextTab);
    setMountedTabs((prev) => (prev[nextTab] ? prev : { ...prev, [nextTab]: true }));
  }, []);

  const handleCardsSubTabChange = useCallback((nextSubTab: CardsSubTabKey) => {
    setCardsSubTab(nextSubTab);
    if (nextSubTab !== "bonuses") {
      setShareTemplateKey(null);
    }
  }, []);

  const handleOpenReferrals = useCallback(
    (templateKey?: string) => {
      setShareTemplateKey(templateKey ?? null);
      setCardsSubTab("bonuses");
      handleTabChange("cards");
    },
    [handleTabChange],
  );

  const handleOpenCard = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const handleOpenCatchUp = useCallback((cardId?: string) => {
    setCatchUpCardId(typeof cardId === "string" ? cardId : null);
    setCatchUpOpen(true);
  }, []);

  const handleCloseCatchUp = useCallback(() => {
    setCatchUpOpen(false);
    setCatchUpCardId(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenYearEnd = useCallback(() => {
    setYearEndOpen(true);
  }, []);

  const handleCloseYearEnd = useCallback(() => {
    setYearEndOpen(false);
  }, []);

  const loadSnapshot = useCallback(async (baseUrl: string, authToken: string) => {
    const snap = await fetchBootstrap({ baseUrl, token: authToken });
    setBootstrap(snap);
    setBootError(null);
  }, []);

  const handleSessionExpired = useCallback(async () => {
    await setStoredToken(null);
    const supported = isBiometricSupported();
    const hasSavedBiometrics = supported && biometricMetaRef.current !== null;
    setBiometricsSupported(supported);
    setAppLocked(false);
    setToken(null);
    setBootstrap(null);
    setAutoPromptBiometrics(hasSavedBiometrics);
    setSessionNotice(
      hasSavedBiometrics
        ? `Your session expired. Sign in with ${getBiometricLabel()} to continue.`
        : "Your session expired. Please sign in again.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedUrl, savedToken, savedMeta, savedLockEnabled] = await Promise.all([
          getStoredServerUrl(),
          getStoredToken(),
          getBiometricMeta(),
          getBiometricLockEnabled(),
        ]);
        if (!active) return;
        const supported = isBiometricSupported();
        setServerUrl(savedUrl);
        setBiometricsSupported(supported);
        setBiometricMeta(savedMeta);
        setBiometricLockEnabled(savedLockEnabled);

        if (savedToken) {
          if (supported && savedLockEnabled) {
            setAppLocked(true);
          }
          setToken(savedToken);
          try {
            await loadSnapshot(savedUrl, savedToken);
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              await setStoredToken(null);
              if (active) {
                const canUseFaceId = supported && savedMeta !== null;
                setAppLocked(false);
                setToken(null);
                setAutoPromptBiometrics(canUseFaceId);
                setSessionNotice(
                  canUseFaceId
                    ? `Your session expired. Sign in with ${getBiometricLabel()} to continue.`
                    : "Your session expired. Please sign in again.",
                );
              }
            } else if (active) {
              setBootError(err instanceof Error ? err.message : "Could not reach server.");
            }
          }
        } else {
          setAutoPromptBiometrics(supported && savedMeta !== null);
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
      const supported = isBiometricSupported();
      if (
        shouldLockOnAppStateChange(state, {
          signedIn: Boolean(tokenRef.current),
          lockEnabled: biometricLockEnabledRef.current && supported,
        })
      ) {
        setAppLocked(true);
        return;
      }
      if (state === "active") {
        setBiometricsSupported(supported);
        if (tokenRef.current && !appLockedRef.current) {
          void loadSnapshot(serverRef.current, tokenRef.current).catch(() => undefined);
        }
      }
    });
    return () => sub.remove();
  }, [loadSnapshot]);

  // Pre-mount remaining tabs in staggered idle slices after Overview paints so first taps are instant.
  const hasBootstrap = bootstrap !== null && !appLocked;
  useEffect(() => {
    if (!hasBootstrap) return;
    const queue: TabKey[] = ["cards", "offers", "points", "people"];
    const timers = queue.map((tab, idx) =>
      setTimeout(
        () => {
          setMountedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
        },
        120 * (idx + 1),
      ),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [hasBootstrap]);

  const handleRefresh = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;
    setRefreshing(true);
    try {
      await loadSnapshot(serverRef.current, activeToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleSessionExpired();
      } else {
        setBanner({
          text: err instanceof Error ? err.message : "Could not refresh.",
          tone: "error",
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [handleSessionExpired, loadSnapshot]);

  const triggerRefresh = useCallback(() => {
    void handleRefresh();
  }, [handleRefresh]);

  const handleRunRawAction = useCallback(
    async (payload: MobileActionPayload, key: string): Promise<MobileActionResponse> => {
      const activeToken = tokenRef.current;
      if (!activeToken) {
        throw new Error("Not signed in.");
      }
      setBusyKey(key);
      setBanner(null);
      try {
        const res = await postMobileAction({
          baseUrl: serverRef.current,
          token: activeToken,
          payload,
        });
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
          await handleSessionExpired();
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
    },
    [handleSessionExpired],
  );

  const handleAction = useCallback(
    async (payload: MobileActionPayload, key: string): Promise<void> => {
      try {
        await handleRunRawAction(payload, key);
      } catch {
        // Error surfaced via banner
      }
    },
    [handleRunRawAction],
  );

  const handleActionReturningCardId = useCallback(
    async (payload: MobileActionPayload, key: string): Promise<string | undefined> => {
      try {
        const res = await handleRunRawAction(payload, key);
        return res.cardId;
      } catch {
        return undefined;
      }
    },
    [handleRunRawAction],
  );

  const handleSignOut = useCallback(async () => {
    const activeToken = tokenRef.current;
    const activeServerUrl = serverRef.current;
    setSettingsOpen(false);
    setSelectedCardId(null);
    setCatchUpOpen(false);
    setYearEndOpen(false);
    setAppLocked(false);
    setAutoPromptBiometrics(false);
    setSessionNotice(null);
    setActiveTab("overview");
    setCardsSubTab("cards");
    setShareTemplateKey(null);
    setMountedTabs(INITIAL_MOUNTED_TABS);
    await setStoredToken(null);
    setToken(null);
    setBootstrap(null);
    if (activeToken) {
      await signOutSession({ baseUrl: activeServerUrl, token: activeToken });
    }
  }, []);

  const handleBiometricSignIn = useCallback(async (): Promise<BiometricSignInOutcome> => {
    if (biometricPromptInFlightRef.current) {
      return { status: "canceled" };
    }
    biometricPromptInFlightRef.current = true;
    const previousEmail = biometricMetaRef.current?.email;
    try {
      const readRes = await readBiometricCredentials();
      if (readRes.status === "canceled") {
        return { status: "canceled" };
      }
      if (readRes.status === "empty") {
        setBiometricMeta(null);
        return { status: "empty", email: previousEmail };
      }
      if (readRes.status === "unavailable") {
        return { status: "error", message: readRes.message };
      }

      const creds = readRes.value;
      try {
        const { token: newToken } = await signInWithEmail({
          baseUrl: creds.serverUrl,
          email: creds.email,
          password: creds.password,
        });
        await Promise.all([setStoredServerUrl(creds.serverUrl), setStoredToken(newToken)]);
        setServerUrl(creds.serverUrl);
        setSessionNotice(null);
        setAppLocked(false);
        setToken(newToken);
        await loadSnapshot(creds.serverUrl, newToken);
        successHaptic();
        return { status: "ok" };
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
          return {
            status: "invalid_credentials",
            email: creds.email,
            message: err.message,
          };
        }
        return {
          status: "error",
          message: err instanceof Error ? err.message : "Could not sign in to Perks.",
        };
      }
    } finally {
      biometricPromptInFlightRef.current = false;
    }
  }, [loadSnapshot]);

  const handleUnlockWithBiometrics = useCallback(async (): Promise<BiometricReadResult<true>> => {
    if (biometricPromptInFlightRef.current) {
      return { status: "canceled" };
    }
    biometricPromptInFlightRef.current = true;
    try {
      const res = await unlockWithBiometrics();
      if (res.status === "ok") {
        setAppLocked(false);
        successHaptic();
        if (tokenRef.current) {
          void loadSnapshot(serverRef.current, tokenRef.current).catch(() => undefined);
        }
      } else if (res.status === "empty") {
        // Biometrics changed on the device and invalidated the lock sentinel — sign out cleanly
        // so the user is never permanently locked out of Perks.
        await disableBiometricLock();
        setBiometricLockEnabled(false);
        await handleSignOut();
        setSessionNotice(
          `${getBiometricLabel()} settings changed on this device. Please sign in again.`,
        );
      }
      return res;
    } finally {
      biometricPromptInFlightRef.current = false;
    }
  }, [handleSignOut, loadSnapshot]);

  const handleEnableBiometricSignIn = useCallback(
    async (password: string): Promise<void> => {
      const email = bootstrap?.user.email;
      if (!email) {
        throw new Error("Could not determine your account email.");
      }
      const activeUrl = serverRef.current;
      const { token: refreshedToken } = await signInWithEmail({
        baseUrl: activeUrl,
        email,
        password,
      });
      const savedMeta = await saveBiometricCredentials({
        email,
        password,
        serverUrl: activeUrl,
      });
      await setStoredToken(refreshedToken);
      setToken(refreshedToken);
      setBiometricMeta(savedMeta);
      successHaptic();
    },
    [bootstrap?.user.email],
  );

  const handleDisableBiometricSignIn = useCallback(async (): Promise<void> => {
    await clearBiometricCredentials();
    setBiometricMeta(null);
  }, []);

  const handleToggleBiometricLock = useCallback(
    async (enabled: boolean): Promise<{ ok: boolean; message?: string }> => {
      const label = getBiometricLabel();
      if (!enabled) {
        await disableBiometricLock();
        setBiometricLockEnabled(false);
        return { ok: true, message: `${label} app lock turned off.` };
      }
      if (biometricPromptInFlightRef.current) {
        return { ok: false };
      }
      biometricPromptInFlightRef.current = true;
      try {
        const res = await enableBiometricLock();
        if (res.status === "ok") {
          setBiometricLockEnabled(true);
          successHaptic();
          return { ok: true, message: `${label} app lock enabled.` };
        }
        if (res.status === "canceled") {
          return { ok: false };
        }
        return {
          ok: false,
          message:
            res.status === "unavailable"
              ? res.message
              : `Could not enable ${label} lock on this device.`,
        };
      } finally {
        biometricPromptInFlightRef.current = false;
      }
    },
    [],
  );

  if (initializing) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <AuthScreen
          initialServerUrl={serverUrl}
          defaultServerUrl={getDefaultServerUrl()}
          biometricsSupported={biometricsSupported}
          biometricMeta={biometricMeta}
          autoPromptBiometrics={autoPromptBiometrics}
          sessionNotice={sessionNotice}
          onSaveServerUrl={async (nextUrl) => {
            const saved = await setStoredServerUrl(nextUrl);
            setServerUrl(saved);
            return saved;
          }}
          onBiometricSignIn={handleBiometricSignIn}
          onSignIn={async (email, password, chosenUrl, saveForBiometrics) => {
            const { token: newToken } = await signInWithEmail({
              baseUrl: chosenUrl,
              email,
              password,
            });
            await setStoredToken(newToken);
            if (saveForBiometrics && isBiometricSupported()) {
              try {
                const savedMeta = await saveBiometricCredentials({
                  email,
                  password,
                  serverUrl: chosenUrl,
                });
                setBiometricMeta(savedMeta);
              } catch {
                // Never block sign-in if saving biometric credentials fails
              }
            }
            setServerUrl(chosenUrl);
            setSessionNotice(null);
            setAppLocked(false);
            setToken(newToken);
            await loadSnapshot(chosenUrl, newToken);
            successHaptic();
          }}
          onSignUp={async (name, email, password, chosenUrl, saveForBiometrics) => {
            const { token: newToken } = await signUpWithEmail({
              baseUrl: chosenUrl,
              name,
              email,
              password,
            });
            await setStoredToken(newToken);
            if (saveForBiometrics && isBiometricSupported()) {
              try {
                const savedMeta = await saveBiometricCredentials({
                  email,
                  password,
                  serverUrl: chosenUrl,
                });
                setBiometricMeta(savedMeta);
              } catch {
                // Never block account creation if saving biometric credentials fails
              }
            }
            setServerUrl(chosenUrl);
            setSessionNotice(null);
            setAppLocked(false);
            setToken(newToken);
            await loadSnapshot(chosenUrl, newToken);
            successHaptic();
          }}
        />
      </View>
    );
  }

  if (appLocked) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <BiometricLockScreen
          email={bootstrap?.user.email ?? biometricMeta?.email ?? null}
          onUnlock={handleUnlockWithBiometrics}
          onSignOut={handleSignOut}
        />
      </View>
    );
  }

  if (!bootstrap) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        {bootError ? (
          <>
            <Text style={styles.errorHeading}>Could not connect to Perks</Text>
            <Text style={styles.errorDetail}>{bootError}</Text>
            <View style={styles.retryRow}>
              <Button label="Retry" onPress={triggerRefresh} loading={refreshing} />
              <Button label="Sign out" variant="secondary" onPress={() => void handleSignOut()} />
            </View>
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  const selectedCard = selectedCardId
    ? (bootstrap.cards.find((c) => c.id === selectedCardId) ?? null)
    : null;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
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
        <TabPane active={activeTab === "overview"} mounted={mountedTabs.overview}>
          <OverviewScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={triggerRefresh}
            onAction={handleAction}
            onOpenCard={handleOpenCard}
            onOpenCatchUp={handleOpenCatchUp}
            onOpenSettings={handleOpenSettings}
            onOpenYearEnd={handleOpenYearEnd}
            onOpenReferrals={handleOpenReferrals}
            onNavigateTab={handleTabChange}
          />
        </TabPane>

        <TabPane active={activeTab === "cards"} mounted={mountedTabs.cards}>
          <CardsScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            subTab={cardsSubTab}
            onSubTabChange={handleCardsSubTabChange}
            shareTemplateKey={shareTemplateKey}
            onRefresh={triggerRefresh}
            onAction={handleActionReturningCardId}
            onVoidAction={handleAction}
            onOpenCard={handleOpenCard}
            onOpenCatchUp={handleOpenCatchUp}
            onNavigateTab={handleTabChange}
          />
        </TabPane>

        <TabPane active={activeTab === "offers"} mounted={mountedTabs.offers}>
          <OffersScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={triggerRefresh}
            onAction={handleAction}
          />
        </TabPane>

        <TabPane active={activeTab === "points"} mounted={mountedTabs.points}>
          <PointsScreen
            data={bootstrap}
            refreshing={refreshing}
            busyKey={busyKey}
            onRefresh={triggerRefresh}
            onAction={handleAction}
          />
        </TabPane>

        <TabPane active={activeTab === "people"} mounted={mountedTabs.people}>
          <PeopleScreen data={bootstrap} refreshing={refreshing} onRefresh={triggerRefresh} />
        </TabPane>
      </View>

      <TabBar active={activeTab} onChange={handleTabChange} bottomInset={insets.bottom} />

      <CardDetailModal
        card={selectedCard}
        today={bootstrap.today}
        catalog={bootstrap.catalog}
        referrals={bootstrap.referrals}
        busyKey={busyKey}
        onClose={handleCloseCard}
        onAction={handleAction}
        onOpenReferrals={handleOpenReferrals}
        onOpenCatchUp={handleOpenCatchUp}
      />

      <CatchUpModal
        visible={catchUpOpen}
        data={bootstrap}
        initialCardId={catchUpCardId}
        busyKey={busyKey}
        onClose={handleCloseCatchUp}
        onRunRawAction={handleRunRawAction}
      />

      <YearEndModal
        visible={yearEndOpen}
        data={bootstrap}
        busyKey={busyKey}
        onClose={handleCloseYearEnd}
        onAction={handleAction}
        onOpenCard={(id) => {
          setYearEndOpen(false);
          setSelectedCardId(id);
        }}
        onOpenReferrals={() => {
          setYearEndOpen(false);
          handleOpenReferrals();
        }}
      />

      <SettingsModal
        visible={settingsOpen}
        data={bootstrap}
        serverUrl={serverUrl}
        busyKey={busyKey}
        biometricsSupported={biometricsSupported}
        biometricMeta={biometricMeta}
        biometricLockEnabled={biometricLockEnabled}
        onClose={handleCloseSettings}
        onRunRawAction={handleRunRawAction}
        onEnableBiometricSignIn={handleEnableBiometricSignIn}
        onDisableBiometricSignIn={handleDisableBiometricSignIn}
        onToggleBiometricLock={handleToggleBiometricLock}
        onSignOut={handleSignOut}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PerksShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const makeStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    tabPaneActive: {
      flex: 1,
      display: "flex",
    },
    tabPaneHidden: {
      flex: 1,
      display: "none",
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
      borderRadius: 12,
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

import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppProvider } from "@/lib/app-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { ToastProvider } from "@/lib/toast-context";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { useReminders } from "@/hooks/use-reminders";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useSyncBackend } from "@/hooks/use-sync-backend";
import { useGroupSync } from "@/hooks/use-group-sync";
import { useOfflineQueueSetup } from "@/hooks/use-offline-queue";
import { OfflineBanner } from "@/components/offline-banner";
import { useChatNotifications } from "@/hooks/use-chat-notifications";

/** Runs inside the tRPC + QueryClient providers so hooks can call tRPC. */
function AppSyncWrapper() {
  try { useAuthSync(); } catch (e) { console.error("[AppSync] useAuthSync error:", e); }
  try { useSyncBackend(); } catch (e) { console.error("[AppSync] useSyncBackend error:", e); }
  try { useGroupSync(); } catch (e) { console.error("[AppSync] useGroupSync error:", e); }
  try { useChatNotifications(); } catch (e) { console.error("[AppSync] useChatNotifications error:", e); }
  let isOffline = false;
  let pendingCount = 0;
  try {
    const result = useOfflineQueueSetup();
    isOffline = result.isOffline;
    pendingCount = result.pendingCount;
  } catch (e) { console.error("[AppSync] useOfflineQueueSetup error:", e); }
  return <OfflineBanner isOffline={isOffline} pendingCount={pendingCount} />;
}

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AppSyncWrapper />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="group/[id]" />
            <Stack.Screen name="group/chat" />
            <Stack.Screen name="group/shopping" />
            <Stack.Screen name="group/carpool" />
            <Stack.Screen name="group/album" />
            <Stack.Screen name="group/tasks" />
            <Stack.Screen name="group/location" />
            <Stack.Screen name="group/polls" />
            <Stack.Screen name="group/share" />
            <Stack.Screen name="group/bilan" />
            <Stack.Screen name="memories" />
            <Stack.Screen name="friends" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="ai-assistant" />
            <Stack.Screen name="login" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="delete-account" />
            <Stack.Screen name="legal/privacy" />
            <Stack.Screen name="legal/terms" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  // Activate automatic reminders
  useReminders();

  // Note: useSyncBackend is called inside the tRPC provider context
  // via a wrapper component to avoid context errors

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <AppProvider>
          <ToastProvider>
            <SafeAreaProvider initialMetrics={providerInitialMetrics}>
              <SafeAreaFrameContext.Provider value={frame}>
                <SafeAreaInsetsContext.Provider value={insets}>
                  {content}
                </SafeAreaInsetsContext.Provider>
              </SafeAreaFrameContext.Provider>
            </SafeAreaProvider>
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppProvider>
        <ToastProvider>
          <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
        </ToastProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

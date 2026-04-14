import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useApp, generateId } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { logger } from "@/lib/logger";

// Clé pour stocker l'ID de la dernière notif traitée au lancement
const LAST_PROCESSED_NOTIF_KEY = "@ravvy_last_processed_notif_id";

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string>("");
  const notificationListener = useRef<Notifications.EventSubscription>(undefined);
  const responseListener = useRef<Notifications.EventSubscription>(undefined);

  const registerTokenMutation = trpc.push.register.useMutation();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Send token to backend so the server can push to this device
        registerTokenMutation.mutate({ token, platform: Platform.OS });
      }
    });

    // Listen for incoming notifications (app in foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: {
          id: generateId(),
          type: (data?.type as any) || "reminder",
          title: title || "Notification",
          message: body || "",
          // Utilise externalGroupId (UUID) en priorité pour que le badge
          // puisse être effacé dans chat.tsx via useLocalSearchParams
          groupId: (data?.externalGroupId ?? data?.groupId) as string | undefined,
          read: false,
          createdAt: new Date().toISOString(),
        },
      });
    });

    // Listen for notification responses (user tapped) — deep link into the group
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      logger.debug("Notification tapped:", response.notification.request.identifier);
      if (data?.externalGroupId) {
        router.push(`/group/${data.externalGroupId}` as any);
      } else if (data?.groupId) {
        router.push(`/group/${data.groupId}` as any);
      }
    });

    // Handle notification tap when app was fully closed.
    // Stocke l'ID traité pour ne pas rejouer la navigation à chaque lancement.
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!response) return;
      const notifId = response.notification.request.identifier;
      try {
        const lastId = await AsyncStorage.getItem(LAST_PROCESSED_NOTIF_KEY);
        if (lastId === notifId) return; // Déjà traité, on ignore
        await AsyncStorage.setItem(LAST_PROCESSED_NOTIF_KEY, notifId);
      } catch {}
      const data = response.notification.request.content.data;
      if (data?.externalGroupId) {
        router.push(`/group/${data.externalGroupId}` as any);
      } else if (data?.groupId) {
        router.push(`/group/${data.groupId}` as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [dispatch]);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token: string | undefined;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Ravvy",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F59E0B",
    });
  }

  if (Platform.OS === "web") {
    return undefined;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      logger.debug("[Notifications] Push notification permission not granted");
      return undefined;
    }
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = tokenData.data;
    } catch (e) {
      logger.warn("[Notifications] Failed to get push token:", e);
    }
  }

  return token;
}

// Schedule local notification
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  delaySeconds = 1
) {
  if (Platform.OS === "web") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: { type: 'timeInterval', seconds: delaySeconds, repeats: false } as any,
  });
}

// Schedule party reminder
export async function schedulePartyReminder(
  partyName: string,
  partyDate: Date,
  groupId: string,
  minutesBefore = 30
) {
  if (Platform.OS === "web") return;

  const triggerDate = new Date(partyDate);
  triggerDate.setMinutes(triggerDate.getMinutes() - minutesBefore);

  if (triggerDate <= new Date()) return; // Don't schedule past notifications

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Rappel : ${partyName}`,
      body: `La soirée commence dans ${minutesBefore} minutes !`,
      data: { type: "reminder", groupId },
      sound: true,
    },
    trigger: { type: 'date', date: triggerDate } as any,
  });
}

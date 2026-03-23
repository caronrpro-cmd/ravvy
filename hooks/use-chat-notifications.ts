import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useApp } from "@/lib/app-provider";

/**
 * Surveille les nouveaux messages chat et affiche une notification locale
 * quand un message arrive d'un autre utilisateur.
 * Monté dans _layout.tsx via AppSyncWrapper pour être toujours actif.
 */
export function useChatNotifications() {
  const { state } = useApp();
  const previousCountRef = useRef<number>(state.chatMessages.length);
  const profileId = state.profile?.id;

  useEffect(() => {
    const currentCount = state.chatMessages.length;

    if (currentCount <= previousCountRef.current) {
      previousCountRef.current = currentCount;
      return;
    }

    const newMessages = state.chatMessages.slice(previousCountRef.current);
    previousCountRef.current = currentCount;

    // Seulement les messages des autres utilisateurs
    const othersMessages = newMessages.filter((m) => m.senderId !== profileId);
    if (othersMessages.length === 0) return;

    const lastMsg = othersMessages[othersMessages.length - 1];
    const group = state.groups.find((g) => g.id === lastMsg.groupId);

    if (Platform.OS !== "web") {
      Notifications.scheduleNotificationAsync({
        content: {
          title: group?.name || "Nouveau message",
          body: `${lastMsg.senderName}: ${lastMsg.text?.substring(0, 100) || "📷 Photo"}`,
          data: { module: "chat", groupId: lastMsg.groupId },
          sound: true,
        },
        trigger: null, // immédiat
      });
    }
  }, [state.chatMessages.length]);
}

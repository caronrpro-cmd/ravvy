import { useRef } from "react";
import { getApiBaseUrl } from "@/constants/oauth";
import { useApp } from "@/lib/app-provider";
import type { ChatMessage } from "@/lib/types";
import { useSSE } from "./use-sse";

/**
 * Connects to /api/events/chat/:backendGroupId and dispatches ADD_MESSAGE_SSE
 * for every message received.
 *
 * Auth, transport (EventSource vs fetch), and reconnection are handled by useSSE.
 */
export function useChatSSE(
  localGroupId: string | undefined,
  backendGroupId: number | null
) {
  const { dispatch } = useApp();

  // Keep localGroupId stable inside the SSE callback without restarting the connection
  const groupIdRef = useRef(localGroupId);
  groupIdRef.current = localGroupId;

  const url = backendGroupId
    ? `${getApiBaseUrl()}/api/events/chat/${backendGroupId}`
    : "";

  return useSSE(url, !!backendGroupId && !!localGroupId, (data) => {
    if (data.type !== "message" || !data.payload) return;
    const msg = data.payload;
    console.log("🔴 [ChatSSE] MESSAGE REÇU:", msg.externalId ?? msg.id, msg.text?.substring(0, 30));
    dispatch({
      type: "ADD_MESSAGE_SSE",
      payload: {
        id: msg.externalId ?? msg.id,
        groupId: groupIdRef.current!,
        senderId: String(msg.senderId),
        senderName: msg.senderName ?? "Inconnu",
        senderAvatar: msg.senderAvatar ?? "",
        text: msg.text ?? "",
        type: msg.type ?? "text",
        imageUrl: msg.imageUrl,
        reactions: msg.reactions ?? [],
        isPinned: msg.isPinned ?? false,
        createdAt: msg.createdAt ?? new Date().toISOString(),
      } satisfies ChatMessage,
    });
  });
}

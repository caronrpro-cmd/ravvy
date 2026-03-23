import { useRef } from "react";
import { getApiBaseUrl } from "@/constants/oauth";
import { useSSE } from "./use-sse";

/**
 * Connects to /api/events/refresh/:backendGroupId and calls onRefresh(module)
 * whenever any group member performs an action. Triggers an immediate refetch
 * instead of waiting for the polling interval.
 *
 * Auth, transport (EventSource vs fetch), and reconnection are handled by useSSE.
 */
export function useGroupRefreshSSE(
  backendGroupId: number | null,
  onRefresh: (module: string, payload: any) => void
) {
  // Stable ref so onRefresh can change between renders without restarting the connection
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const url = backendGroupId
    ? `${getApiBaseUrl()}/api/events/refresh/${backendGroupId}`
    : "";

  return useSSE(url, !!backendGroupId, (data) => {
    if (data.type === "refresh" && data.module) {
      onRefreshRef.current(data.module, data);
    }
  });
}

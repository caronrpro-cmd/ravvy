import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  getQueue,
  enqueueOfflineAction,
  removeOfflineAction,
  type OfflineActionType,
  type QueuedAction,
} from "@/lib/offline-queue";

// ===== Module-level singletons =====
// Safe in React Native (single JS thread, no SSR).

type ReplayHandler = (action: QueuedAction) => Promise<void>;
const _handlers = new Map<OfflineActionType, ReplayHandler>();
let _setPendingCount: ((fn: (n: number) => number) => void) | null = null;
let _setIsOffline: ((v: boolean) => void) | null = null;
// Prevents re-enqueueing items while the queue is being replayed
let _isReplaying = false;

// ===== Public helpers (callable outside React) =====

/**
 * Persists a failed action to the offline queue.
 * Safe to call from mutation onError callbacks.
 * No-op while a replay is in progress (prevents duplicate entries).
 */
export async function enqueueOffline(
  type: OfflineActionType,
  payload: any
): Promise<void> {
  if (_isReplaying) return;
  await enqueueOfflineAction(type, payload);
  _setPendingCount?.((n) => n + 1);
}

/**
 * Called by useMutationWithToast when a network error is detected.
 * Updates the offline banner state without requiring NetInfo.
 */
export function notifyNetworkError(): void {
  _setIsOffline?.(true);
}

// ===== Setup hook (mount once at app root) =====

/**
 * Initialises the offline queue system.
 * Must be called inside the tRPC + QueryClient provider tree.
 * Returns { isOffline, pendingCount } for the offline banner.
 */
export function useOfflineQueueSetup(): {
  isOffline: boolean;
  pendingCount: number;
} {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const isProcessingRef = useRef(false);

  // Expose state setters to module-level helpers
  useEffect(() => {
    _setPendingCount = setPendingCount;
    _setIsOffline = setIsOffline;
    return () => {
      _setPendingCount = null;
      _setIsOffline = null;
    };
  }, []);

  // Hydrate pending count from storage on mount
  useEffect(() => {
    getQueue().then((q) => setPendingCount(q.length));
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    _isReplaying = true;
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;

      for (const action of queue) {
        const handler = _handlers.get(action.type);
        if (!handler) continue; // screen not mounted — skip, keep in queue

        try {
          await handler(action);
          await removeOfflineAction(action.id);
          setPendingCount((n) => Math.max(0, n - 1));
          // At least one success — we're back online
          setIsOffline(false);
        } catch {
          // Stop on first failure to preserve ordering
          break;
        }
      }
    } finally {
      _isReplaying = false;
      isProcessingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      // Web: native online/offline events
      const handleOnline = () => {
        setIsOffline(false);
        processQueue();
      };
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      setIsOffline(!navigator.onLine);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    } else {
      // Native: replay when app is foregrounded + periodic 30s retry
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") processQueue();
      });
      const interval = setInterval(processQueue, 30_000);

      return () => {
        subscription.remove();
        clearInterval(interval);
      };
    }
  }, [processQueue]);

  return { isOffline, pendingCount };
}

// ===== Per-screen handler registration =====

/**
 * Registers a mutation replay callback for the given action type.
 * Unregisters automatically on unmount.
 * The handler ref is always kept up-to-date — no stale closure issues.
 */
export function useRegisterOfflineHandler(
  type: OfflineActionType,
  handler: (action: QueuedAction) => Promise<void>
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    _handlers.set(type, (action) => handlerRef.current(action));
    return () => {
      _handlers.delete(type);
    };
  }, [type]);
}

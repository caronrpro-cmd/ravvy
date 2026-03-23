import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Auth from "@/lib/_core/auth";

// ===== SSE frame parser =====
// Parses text/event-stream chunks: splits on "\n\n" event boundaries,
// extracts every "data: " line, returns the unconsumed tail for the next chunk.
function parseSseChunk(
  buffer: string,
  chunk: string,
  onData: (raw: string) => void
): string {
  buffer += chunk;
  const events = buffer.split("\n\n");
  const residual = events.pop() ?? "";
  for (const event of events) {
    for (const line of event.split("\n")) {
      if (line.startsWith("data: ")) onData(line.slice(6));
    }
  }
  return residual;
}

// ===== Generic SSE hook =====

/**
 * Establishes a persistent SSE connection and calls `onMessage` for every
 * parsed JSON frame received.
 *
 * - Web    : uses the native EventSource API (cookie auth, withCredentials)
 * - Native : uses fetch + ReadableStream (Bearer token from SecureStore)
 * - Auto-reconnects after 3 s on any disconnection.
 * - `onMessage` is wrapped in a ref — always up to date, never triggers reconnects.
 * - Connection is torn down and restarted whenever `url` or `enabled` changes.
 *
 * @param url     Full SSE endpoint URL. Pass an empty string to disable.
 * @param enabled When false the connection is not opened (and any open one is closed).
 * @param onMessage Called for each successfully parsed JSON event.
 * @returns `{ connected, error }` — reactive status suitable for UI indicators.
 */
export function useSSE(
  url: string,
  enabled: boolean,
  onMessage: (data: any) => void
): { connected: boolean; error: string | null } {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so the callback can change between renders without restarting the connection
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !url) return;

    let stopped = false;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let abortController: AbortController | null = null;
    let es: EventSource | null = null;

    function handleRaw(raw: string) {
      try {
        const parsed = JSON.parse(raw);
        console.log("[SSE]", url.split("/api/events/")[1] ?? url, parsed);
        onMessageRef.current(parsed);
      } catch {
        // malformed JSON — skip silently
      }
    }

    function scheduleRetry() {
      if (stopped) return;
      setConnected(false);
      retryTimeout = setTimeout(connect, 3_000);
    }

    function connectWeb() {
      if (stopped) return;
      const source = new EventSource(url, { withCredentials: true });
      es = source;

      source.addEventListener("open", () => {
        setConnected(true);
        setError(null);
      });
      source.addEventListener("message", (e: MessageEvent) => handleRaw(e.data));
      source.onerror = () => {
        source.close();
        es = null;
        setConnected(false);
        setError("Connexion interrompue");
        scheduleRetry();
      };
    }

    function connectNative() {
      if (stopped) return;
      const controller = new AbortController();
      abortController = controller;

      (async () => {
        try {
          const token = await Auth.getSessionToken();
          const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            setError(`Erreur HTTP ${response.status}`);
            scheduleRetry();
            return;
          }

          setConnected(true);
          setError(null);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer = parseSseChunk(
              buffer,
              decoder.decode(value, { stream: true }),
              handleRaw
            );
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          setError((err as Error).message || "Erreur de connexion");
        }
        scheduleRetry();
      })();
    }

    function connect() {
      if (Platform.OS === "web") connectWeb();
      else connectNative();
    }

    connect();

    return () => {
      stopped = true;
      setConnected(false);
      clearTimeout(retryTimeout);
      abortController?.abort();
      abortController = null;
      es?.close();
      es = null;
    };
  }, [url, enabled]);

  return { connected, error };
}

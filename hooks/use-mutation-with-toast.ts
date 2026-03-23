import { useCallback, useRef, useState } from "react";
import { enqueueOffline, notifyNetworkError } from "./use-offline-queue";
import { useToast } from "@/lib/toast-context";
import type { OfflineActionType } from "@/lib/offline-queue";

// ===== Error translation =====

function translateError(err: unknown): string {
  const msg: string =
    (err as any)?.message ?? (err as any)?.data?.message ?? "";

  if (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("net::ERR_")
  )
    return "Erreur réseau. Vérifiez votre connexion internet.";

  if (msg.includes("UNAUTHORIZED") || msg.includes("401"))
    return "Vous devez être connecté pour effectuer cette action.";
  if (msg.includes("FORBIDDEN") || msg.includes("403"))
    return "Vous n'avez pas les droits pour effectuer cette action.";
  if (msg.includes("NOT_FOUND") || msg.includes("404"))
    return "L'élément demandé est introuvable.";
  if (msg.includes("CONFLICT") || msg.includes("409"))
    return "Cette action entre en conflit avec une modification récente.";
  if (msg.includes("TOO_MANY_REQUESTS") || msg.includes("429"))
    return "Trop de requêtes. Attendez quelques instants.";
  if (msg.includes("timeout") || msg.includes("TIMEOUT"))
    return "La requête a pris trop de temps. Réessayez.";
  if (msg.includes("BAD_REQUEST") || msg.includes("400"))
    return "Données invalides. Vérifiez les champs du formulaire.";

  if (msg) return msg;
  return "Une erreur inattendue s'est produite.";
}

function isNetworkError(err: unknown): boolean {
  const msg: string = (err as any)?.message ?? "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("net::ERR_") ||
    (err as any)?.cause?.code === "ECONNREFUSED"
  );
}

// ===== Hook =====

type BuildOptionsArgs = {
  onError?: (err: any, variables: any, context: any) => void | false;
  onSuccess?: (data: any, variables: any, context: any) => void;
  /**
   * Set to true to suppress the default error toast.
   * Useful when the caller already handles errors (e.g., try/catch around mutateAsync).
   * Network retry still runs regardless of this flag.
   */
  silent?: boolean;
  /**
   * When set, a network-error failure is automatically added to the offline queue
   * (persisted in AsyncStorage) and replayed when connectivity is restored.
   * The `variables` passed to the mutation are stored as the replay payload.
   */
  offlineType?: OfflineActionType;
};

/**
 * Wraps tRPC mutations with:
 * - A default French error toast (Alert on native, alert() on web)
 * - A shared `isLoading` state (counter-based, safe for concurrent mutations)
 * - Auto-retry once on network errors (via TanStack Query's retry option)
 *
 * Usage:
 *   const { isLoading, buildOptions } = useMutationWithToast();
 *   const addMutation = trpc.foo.add.useMutation(
 *     buildOptions({ onSuccess: () => refetch() })
 *   );
 */
export function useMutationWithToast() {
  const [isLoading, setIsLoading] = useState(false);
  // Counter tracks concurrent in-flight mutations to avoid premature isLoading=false
  const inflightRef = useRef(0);
  const { showError } = useToast();

  // showErrorRef lets us avoid adding showError to buildOptions' deps while staying fresh
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;

  const buildOptions = useCallback((opts?: BuildOptionsArgs) => ({
    // Retry once on network errors; other errors bubble to onError immediately
    retry: (failureCount: number, err: unknown): boolean =>
      isNetworkError(err) && failureCount < 1,
    retryDelay: 1500,

    onMutate: () => {
      inflightRef.current += 1;
      setIsLoading(true);
    },

    onError: (err: any, variables: any, context: any): void => {
      if (isNetworkError(err)) {
        notifyNetworkError();
        if (opts?.offlineType) {
          enqueueOffline(opts.offlineType, variables); // fire-and-forget
        }
      }
      // Custom handler runs first; returning false suppresses the default toast
      const customResult = opts?.onError?.(err, variables, context);
      if (!opts?.silent && customResult !== false) {
        showErrorRef.current(translateError(err));
      }
    },

    onSuccess: (data: any, variables: any, context: any): void => {
      opts?.onSuccess?.(data, variables, context);
    },

    onSettled: (): void => {
      inflightRef.current = Math.max(0, inflightRef.current - 1);
      if (inflightRef.current === 0) setIsLoading(false);
    },
  }), []);

  return { isLoading, buildOptions };
}

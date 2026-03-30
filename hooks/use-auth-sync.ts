import { useEffect } from "react";
import { useApp } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";

/**
 * Bridges the OAuth authentication layer with the app state.
 *
 * Queries the backend profile on every app start. When a valid session exists
 * (cookie on web, Bearer token on native), the backend returns the full user
 * and we populate state.profile — the single source of truth for "logged in".
 *
 * Also handles session expiration: if the backend returns UNAUTHORIZED we
 * dispatch LOGOUT to clear stale app state.
 */
export function useAuthSync() {
  const { state, dispatch } = useApp();

  const isGuest = state.profile?.id?.startsWith("guest-");
const profileQuery = trpc.profile.get.useQuery(undefined, {
  retry: false,
  staleTime: 60_000,
  enabled: !isGuest,
});

  // Populate app profile from backend user (on first load or after login)
  useEffect(() => {
    if (!profileQuery.data) return;
    const p = profileQuery.data;
    const profileId = String(p.id);
    // Skip if already up-to-date
    if (state.profile?.id === profileId) return;

    dispatch({
      type: "SET_PROFILE",
      payload: {
        id: profileId,
        name: p.name || "Utilisateur",
        username: p.username || p.email?.split("@")[0] || "utilisateur",
        bio: p.bio || "",
        avatar: p.avatar || "",
        status: (p.status as "available" | "busy" | "away" | "dnd") || "available",
        createdAt: p.createdAt || new Date().toISOString(),
      },
    });
  }, [profileQuery.data]);

  // Clear stale profile when session expires
  useEffect(() => {
    if (!profileQuery.error) return;
    const code = (profileQuery.error as any)?.data?.code;
    const isGuest = state.profile?.id?.startsWith("guest-");
if (code === "UNAUTHORIZED" && state.profile && !isGuest) {
      dispatch({ type: "LOGOUT" });
    }
  }, [profileQuery.error]);

  return profileQuery;
}

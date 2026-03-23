import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useApp } from "@/lib/app-provider";
import { GroupSyncPayload } from "@/lib/types";
import { trpc } from "@/lib/trpc";

const RETRY_INTERVAL_MS = 30_000;

export function useGroupSync() {
  const { state, dispatch } = useApp();
  const utils = trpc.useUtils();
  const isRetryingRef = useRef(false);

  const createGroupMutation = trpc.groups.create.useMutation();
  const addTaskMutation = trpc.tasks.add.useMutation();
  const addShoppingItemMutation = trpc.shopping.add.useMutation();
  const addPollMutation = trpc.polls.add.useMutation();

  // Groupes en attente de sync (failed = tentative précédente échouée)
  const failedGroups = state.groups.filter(
    (g) => (g.syncStatus === "failed" || g.syncStatus === "pending") && g.syncPayload
  );

  const syncItems = (backendGroupId: number, payload: GroupSyncPayload) => {
    payload.tasks.forEach((task) => {
      addTaskMutation.mutate({
        externalId: task.externalId,
        groupId: backendGroupId,
        title: task.title,
        priority: task.priority,
      });
    });
    payload.shoppingItems.forEach((item) => {
      addShoppingItemMutation.mutate({
        externalId: item.externalId,
        groupId: backendGroupId,
        name: item.name,
        price: item.price,
      });
    });
    payload.polls.forEach((poll) => {
      addPollMutation.mutate({
        externalId: poll.externalId,
        groupId: backendGroupId,
        question: poll.question,
        options: poll.options,
      });
    });
  };

  const retryGroup = async (groupId: string, syncPayload: GroupSyncPayload) => {
    try {
      const data = await createGroupMutation.mutateAsync({
        externalId: groupId,
        name: syncPayload.name,
        description: syncPayload.description,
        type: syncPayload.type,
        date: syncPayload.date,
        time: syncPayload.time,
        location: syncPayload.location,
        shareCode: syncPayload.shareCode,
      });
      dispatch({
        type: "UPDATE_GROUP",
        payload: { id: groupId, updates: { syncStatus: "synced", syncPayload: undefined } },
      });
      syncItems(data.id, syncPayload);
      utils.groups.list.invalidate();
    } catch {
      dispatch({
        type: "UPDATE_GROUP",
        payload: { id: groupId, updates: { syncStatus: "failed" } },
      });
    }
  };

  const retryAll = async (groups: typeof failedGroups) => {
    if (isRetryingRef.current || groups.length === 0) return;
    isRetryingRef.current = true;
    try {
      for (const group of groups) {
        if (group.syncPayload) {
          await retryGroup(group.id, group.syncPayload);
        }
      }
    } finally {
      isRetryingRef.current = false;
    }
  };

  // Réessai automatique toutes les 30 secondes
  useEffect(() => {
    if (failedGroups.length === 0) return;
    const captured = failedGroups;
    const interval = setInterval(() => retryAll(captured), RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [failedGroups.length]);

  // Réessai quand l'app repasse en foreground
  useEffect(() => {
    if (failedGroups.length === 0) return;
    const captured = failedGroups;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") retryAll(captured);
    });
    return () => sub.remove();
  }, [failedGroups.length]);

  // Réessai initial au montage si des groupes sont en attente
  useEffect(() => {
    if (failedGroups.length > 0) retryAll(failedGroups);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { failedGroups, retryGroup };
}

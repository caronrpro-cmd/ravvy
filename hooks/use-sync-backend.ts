import { useEffect, useRef } from "react";
import { useApp, generateInvitationCode } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";

/**
 * Hook de synchronisation backend
 * Synchronise les données locales avec le serveur quand l'utilisateur est authentifié
 */
export function useSyncBackend() {
  const { state, dispatch } = useApp();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const utils = trpc.useUtils();

  // Synchroniser les groupes avec le backend
  const syncGroupsQuery = trpc.groups.list.useQuery(undefined, {
    enabled: !!state.profile?.id,
    refetchInterval: 30000, // Sync every 30 seconds
  });

  // Synchroniser les messages avec le backend
  const syncMessagesQuery = (groupId: number) => {
    return trpc.chat.messages.useQuery(
      { groupId, limit: 100 },
      { enabled: !!state.profile?.id }
    );
  };

  // Créer un groupe sur le backend
  const createGroupMutation = trpc.groups.create.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
    },
  });

  // Envoyer un message
  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.chat.messages.invalidate();
    },
  });

  // Ajouter un article de course
  const addShoppingItemMutation = trpc.shopping.add.useMutation({
    onSuccess: () => {
      utils.shopping.list.invalidate();
    },
  });

  // Ajouter une dépense
  const addExpenseMutation = trpc.expenses.add.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
    },
  });

  // Ajouter une tâche
  const addTaskMutation = trpc.tasks.add.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
    },
  });

  // Ajouter un sondage
  const addPollMutation = trpc.polls.add.useMutation({
    onSuccess: () => {
      utils.polls.list.invalidate();
    },
  });

  // Ajouter un covoiturage
  const addCarpoolMutation = trpc.carpool.add.useMutation({
    onSuccess: () => {
      utils.carpool.list.invalidate();
    },
  });

  // Ajouter une photo
  const addPhotoMutation = trpc.photos.add.useMutation({
    onSuccess: () => {
      utils.photos.list.invalidate();
    },
  });

  // Mettre à jour le RSVP
  const updateRsvpMutation = trpc.groups.updateRsvp.useMutation({
    onSuccess: () => {
      utils.groups.list.invalidate();
    },
  });

  // Synchroniser les groupes du backend vers l'état local
  useEffect(() => {
    if (!syncGroupsQuery.data || !state.profile?.id) return;

    syncGroupsQuery.data.forEach((backendGroup) => {
      const localGroup = state.groups.find((g) => g.id === backendGroup.externalId);

      // Map backend members to app GroupMember shape
      const members = (backendGroup.members ?? []).map((m: any) => ({
        id: String(m.userId),
        name: m.name || "Inconnu",
        username: m.username || "",
        avatar: m.avatar || "",
        rsvp: (m.rsvp as "present" | "absent" | "maybe" | "pending") || "pending",
        role: (m.role as "admin" | "member") || "member",
      }));

      const groupPayload = {
        id: backendGroup.externalId,
        name: backendGroup.name,
        description: backendGroup.description || "",
        type: (backendGroup.type as "classic" | "auto-destruct") || "classic",
        date: backendGroup.date || "",
        time: backendGroup.time || "",
        location: backendGroup.location || "",
        members,
        coverImage: backendGroup.coverImage || "",
        createdBy: backendGroup.createdBy.toString(),
        createdAt: backendGroup.createdAt?.toString() || new Date().toISOString(),
        // Use stable backend shareCode; only generate locally if server has none
        invitationCode: backendGroup.shareCode || localGroup?.invitationCode || generateInvitationCode(),
      };

      if (!localGroup) {
        dispatch({ type: "ADD_GROUP", payload: { ...groupPayload, syncStatus: "synced" } });
      } else {
        // Update existing group with fresh backend data (name, members, etc.)
        dispatch({
          type: "UPDATE_GROUP",
          payload: {
            id: backendGroup.externalId,
            updates: {
              name: groupPayload.name,
              description: groupPayload.description,
              date: groupPayload.date,
              time: groupPayload.time,
              location: groupPayload.location,
              members: groupPayload.members,
              coverImage: groupPayload.coverImage,
              syncStatus: "synced" as const,
              syncPayload: undefined,
              // Only update invitationCode if backend has an authoritative shareCode;
              // otherwise preserve whatever the local group already has.
              ...(backendGroup.shareCode ? { invitationCode: backendGroup.shareCode } : {}),
            },
          },
        });
      }
    });
  }, [syncGroupsQuery.data, state.profile?.id]);

  // Détecte les groupes supprimés côté serveur et les retire du state local
  useEffect(() => {
    if (!syncGroupsQuery.data || !state.profile?.id) return;
    const backendGroupIds = new Set(syncGroupsQuery.data.map((g) => g.externalId));
    state.groups.forEach((localGroup) => {
      // Ignore les groupes créés offline (guest) qui n'ont pas encore été synchronisés
      if (localGroup.createdBy?.startsWith("guest-")) return;
      if (localGroup.syncStatus !== "synced") return;
      if (!backendGroupIds.has(localGroup.id)) {
        dispatch({ type: "DELETE_GROUP", payload: localGroup.id });
      }
    });
  }, [syncGroupsQuery.data, state.profile?.id]);

  return {
    // Queries
    syncGroupsQuery,
    syncMessagesQuery,

    // Mutations
    createGroupMutation,
    sendMessageMutation,
    addShoppingItemMutation,
    addExpenseMutation,
    addTaskMutation,
    addPollMutation,
    addCarpoolMutation,
    addPhotoMutation,
    updateRsvpMutation,

    // Utils
    utils,
  };
}

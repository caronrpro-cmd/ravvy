import { useState, useEffect } from "react";
import { Text, View, Pressable, ScrollView, Alert, Platform, ActivityIndicator, TextInput, Modal, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { formatDate, getTimeRemaining } from "@/lib/helpers";
import { trpc } from "@/lib/trpc";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { getAvatarColor } from "@/lib/avatar-color";

const RSVP_CONFIG = {
  present: { label: "Présent", color: "#10B981", emoji: "✅" },
  absent: { label: "Absent", color: "#EF4444", emoji: "❌" },
  maybe: { label: "Peut-être", color: "#F59E0B", emoji: "🤔" },
  pending: { label: "En attente", color: "#6B7280", emoji: "⏳" },
};

export default function GroupHubScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showRsvpList, setShowRsvpList] = useState(false);
  const [rsvpFilter, setRsvpFilter] = useState<"all" | "present" | "absent" | "maybe" | "pending">("all");
  const [sosAlert, setSosAlert] = useState<{ senderName: string; timestamp: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLocation, setEditLocation] = useState("");

  // All hooks MUST come before any conditional return
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: id! },
    { enabled: !!id, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;
  const utils = trpc.useUtils();
  const updateRsvpMutation = trpc.groups.updateRsvp.useMutation();
  const deleteGroupMutation = trpc.groups.delete.useMutation();
  const leaveGroupMutation = trpc.groups.leave.useMutation();
  const updateCoverMutation = trpc.groups.updateCover.useMutation();
  const updateGroupMutation = trpc.groups.update.useMutation();
  const retrySyncMutation = trpc.groups.create.useMutation();
  const retryAddTaskMutation = trpc.tasks.add.useMutation();
  const retryAddShoppingMutation = trpc.shopping.add.useMutation();
  const retryAddPollMutation = trpc.polls.add.useMutation();

  // SSE : si le groupe est supprimé par l'admin, on retire le groupe et on navigue vers l'accueil
  // SSE : alerte SOS reçue d'un autre membre
  useGroupRefreshSSE(backendGroupId, (module, payload) => {
    if (module === "group_deleted") {
      dispatch({ type: "DELETE_GROUP", payload: id! });
      router.replace("/(tabs)");
    }
    if (module === "sos") {
      const name = payload?.senderName || "Un membre";
      setSosAlert({ senderName: name, timestamp: new Date().toISOString() });
      setTimeout(() => setSosAlert(null), 60000);
    }
    if (module === "group_updated") {
      utils.groups.list.invalidate();
    }
  });

  // Détecte les messages SOS épinglés récents dans le chat pour afficher la bannière
  useEffect(() => {
    const sosMessages = state.chatMessages.filter(
      (m) => m.groupId === id && m.text?.startsWith("🆘") && m.isPinned
    );
    if (sosMessages.length === 0) return;
    const latest = sosMessages[sosMessages.length - 1];
    const msgTime = new Date(latest.createdAt).getTime();
    if (Date.now() - msgTime < 5 * 60 * 1000) {
      setSosAlert({ senderName: latest.senderName, timestamp: latest.createdAt });
    }
  }, [state.chatMessages, id]);

  const group = state.groups.find((g) => g.id === id);
  if (!group) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Groupe non trouvé</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Text style={{ color: colors.primary, marginTop: 10, fontWeight: "600" }}>Retour</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const isAdmin = group.createdBy === (state.profile?.id || "user_1");
  const myMember = group.members.find((m) => m.id === state.profile?.id);
  const presentCount = group.members.filter((m) => m.rsvp === "present").length;
  const absentCount = group.members.filter((m) => m.rsvp === "absent").length;
  const maybeCount = group.members.filter((m) => m.rsvp === "maybe").length;
  const pendingCount = group.members.filter((m) => m.rsvp === "pending").length;
  const groupTasks = state.tasks.filter((t) => t.groupId === id);
  const groupMessages = state.chatMessages.filter((m) => m.groupId === id);

  const filteredMembers = rsvpFilter === "all"
    ? group.members
    : group.members.filter((m) => m.rsvp === rsvpFilter);

  const handleRsvp = (rsvp: "present" | "absent" | "maybe") => {
    if (state.profile) {
      dispatch({
        type: "UPDATE_RSVP",
        payload: { groupId: id!, memberId: state.profile.id, rsvp },
      });
      if (backendGroupId) {
        updateRsvpMutation.mutate({ groupId: backendGroupId, rsvp });
      }
    }
  };

  const handleLeaveGroup = () => {
    const doLeave = () => {
      if (backendGroupId) {
        leaveGroupMutation.mutate({ groupId: backendGroupId });
      }
      dispatch({ type: "DELETE_GROUP", payload: id! });
      router.replace("/(tabs)");
    };

    if (Platform.OS === "web") {
      if (confirm("Voulez-vous vraiment quitter ce groupe ?")) doLeave();
    } else {
      Alert.alert("Quitter le groupe", "Voulez-vous vraiment quitter ce groupe ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Quitter", style: "destructive", onPress: doLeave },
      ]);
    }
  };

  const handleCancelEvent = () => {
    const doCancel = () => {
      if (backendGroupId) {
        deleteGroupMutation.mutate({ groupId: backendGroupId });
      }
      dispatch({ type: "DELETE_GROUP", payload: id! });
      router.replace("/(tabs)");
    };

    if (Platform.OS === "web") {
      if (confirm("Voulez-vous vraiment annuler cette soirée ? Tous les membres seront notifiés.")) doCancel();
    } else {
      Alert.alert(
        "Annuler la soirée",
        "Tous les membres seront notifiés. Cette action est irréversible.",
        [
          { text: "Non", style: "cancel" },
          { text: "Annuler la soirée", style: "destructive", onPress: doCancel },
        ]
      );
    }
  };

  const handleRetrySync = () => {
    if (!group.syncPayload) return;
    const payload = group.syncPayload;
    retrySyncMutation.mutate(
      {
        externalId: id!,
        name: payload.name,
        description: payload.description,
        type: payload.type,
        date: payload.date,
        time: payload.time,
        location: payload.location,
        shareCode: payload.shareCode,
      },
      {
        onSuccess: (data) => {
          const backendId = data.id;
          dispatch({ type: "UPDATE_GROUP", payload: { id: id!, updates: { syncStatus: "synced", syncPayload: undefined } } });
          payload.tasks.forEach((task) => {
            retryAddTaskMutation.mutate({ externalId: task.externalId, groupId: backendId, title: task.title, priority: task.priority });
          });
          payload.shoppingItems.forEach((item) => {
            retryAddShoppingMutation.mutate({ externalId: item.externalId, groupId: backendId, name: item.name, price: item.price });
          });
          payload.polls.forEach((poll) => {
            retryAddPollMutation.mutate({ externalId: poll.externalId, groupId: backendId, question: poll.question, options: poll.options });
          });
        },
        onError: () => {
          dispatch({ type: "UPDATE_GROUP", payload: { id: id!, updates: { syncStatus: "failed" } } });
        },
      }
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await backendGroupQuery.refetch(); } finally { setRefreshing(false); }
  };

  const openEditModal = () => {
    setEditName(group?.name || "");
    setEditDesc(group?.description || "");
    setEditDate(group?.date || "");
    setEditTime(group?.time || "");
    setEditLocation(group?.location || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !group) return;
    dispatch({
      type: "UPDATE_GROUP",
      payload: {
        id: id!,
        updates: {
          name: editName.trim(),
          description: editDesc.trim(),
          date: editDate.trim(),
          time: editTime.trim(),
          location: editLocation.trim(),
        },
      },
    });
    if (backendGroupId) {
      updateGroupMutation.mutate({
        groupId: backendGroupId,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        date: editDate.trim() || undefined,
        time: editTime.trim() || undefined,
        location: editLocation.trim() || undefined,
      });
    }
    setShowEditModal(false);
  };

  const handleChangeBanner = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;

      const localUri = result.assets[0].uri;

      // Affichage optimiste immédiat
      dispatch({ type: "UPDATE_GROUP", payload: { id: id!, updates: { coverImage: localUri } } });

      // Upload vers le serveur
      const apiBase = getApiBaseUrl();
      if (apiBase && backendGroupId) {
        const formData = new FormData();
        const filename = localUri.split("/").pop() || "banner.jpg";
        formData.append("file", { uri: localUri, name: filename, type: "image/jpeg" } as any);

        const token = await Auth.getSessionToken();
        const response = await fetch(`${apiBase}/api/upload/photo`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (response.ok) {
          const { url: serverUrl } = await response.json();
          // Remplace l'URI locale par l'URL serveur accessible à tous
          dispatch({ type: "UPDATE_GROUP", payload: { id: id!, updates: { coverImage: serverUrl } } });
          // Sync au backend pour que les autres membres voient la nouvelle bannière
          updateCoverMutation.mutate({ groupId: backendGroupId, coverImage: serverUrl });
        }
      }
    } catch (err) {
      console.warn("[Banner] upload failed:", err);
    }
  };

  const modules = [
    { icon: "bubble.left.fill" as const, label: "Chat", color: "#06B6D4", route: `/group/chat?groupId=${id}`, badge: groupMessages.length },
    { icon: "cart.fill" as const, label: "Courses", color: "#10B981", route: `/group/shopping?groupId=${id}`, badge: 0 },
    { icon: "car.fill" as const, label: "Covoiturage", color: "#3B82F6", route: `/group/carpool?groupId=${id}`, badge: 0 },
    { icon: "photo.fill" as const, label: "Album", color: "#EC4899", route: `/group/album?groupId=${id}`, badge: 0 },
    { icon: "checkmark.circle.fill" as const, label: "Tâches", color: "#F59E0B", route: `/group/tasks?groupId=${id}`, badge: groupTasks.filter((t) => !t.completed).length },
    { icon: "location.fill" as const, label: "Localisation", color: "#F97316", route: `/group/location?groupId=${id}`, badge: 0 },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-2">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-lg font-bold" style={{ flex: 1 }} numberOfLines={1}>
            {group.name}
          </Text>
          {/* Edit button (admin only) */}
          {isAdmin && (
            <Pressable
              onPress={openEditModal}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="pencil" size={16} color={colors.foreground} />
            </Pressable>
          )}
          {/* Share button */}
          <Pressable
            onPress={() => router.push(`/group/share?groupId=${id}` as any)}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.primary + "15",
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={16} color={colors.primary} />
          </Pressable>
          {group.type === "auto-destruct" && (
            <View
              style={{
                backgroundColor: "#F97316",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconSymbol name="timer" size={12} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "600" }}>
                {getTimeRemaining(group.expiresAt!)}
              </Text>
            </View>
          )}
        </View>

        {/* Bannière SOS */}
        {sosAlert && (
          <Pressable
            onPress={() => router.push(`/group/location?groupId=${id}` as any)}
            style={({ pressed }) => [
              {
                marginHorizontal: 20,
                marginBottom: 12,
                backgroundColor: "#EF4444",
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                shadowColor: "#EF4444",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 28 }}>🆘</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>ALERTE SOS</Text>
              <Text style={{ color: "#FFFFFFCC", fontSize: 13, marginTop: 2 }}>
                {sosAlert.senderName} a besoin d'aide !
              </Text>
              <Text style={{ color: "#FFFFFFAA", fontSize: 11, marginTop: 2 }}>
                Appuyez pour voir sa position
              </Text>
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); setSosAlert(null); }}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <IconSymbol name="xmark" size={18} color="#FFFFFFAA" />
            </Pressable>
          </Pressable>
        )}

        {/* Cover / Banner */}
        <View className="px-5 mb-4">
          <Pressable onPress={isAdmin ? handleChangeBanner : undefined}>
            <View
              style={{
                height: 160,
                borderRadius: 20,
                backgroundColor: colors.primary,
                justifyContent: "flex-end",
                padding: 16,
                overflow: "hidden",
              }}
            >
              {group.coverImage ? (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  <Image
                    source={{ uri: group.coverImage }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
                </View>
              ) : null}
              {isAdmin && (
                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <IconSymbol name="photo.fill" size={12} color="#FFF" />
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>Modifier</Text>
                </View>
              )}
              <Text style={{ color: "#FFF", fontSize: 22, fontWeight: "800" }}>{group.name}</Text>
              <Text style={{ color: "#FFFFFFCC", fontSize: 13, marginTop: 4 }}>
                {formatDate(group.date)} · {group.time}
              </Text>
              <Text style={{ color: "#FFFFFFCC", fontSize: 13, marginTop: 2 }}>
                📍 {group.location}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Bannière de statut de synchronisation */}
        {(group.syncStatus === "failed" || group.syncStatus === "pending") && (
          <View
            style={{
              marginHorizontal: 20,
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: group.syncStatus === "failed" ? "#F9731615" : "#6B728015",
              borderWidth: 1,
              borderColor: group.syncStatus === "failed" ? "#F97316" : "#6B7280",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: group.syncStatus === "failed" ? "#F97316" : "#6B7280", fontWeight: "700", fontSize: 13 }}>
                {group.syncStatus === "failed" ? "⚠ Synchronisation échouée" : "⏳ Synchronisation en cours…"}
              </Text>
              <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 2 }}>
                {group.syncStatus === "failed"
                  ? "Le groupe n'a pas pu être synchronisé avec le serveur."
                  : "Le groupe sera disponible pour les autres dès la connexion rétablie."}
              </Text>
            </View>
            {group.syncStatus === "failed" && group.syncPayload && (
              <Pressable
                onPress={handleRetrySync}
                disabled={retrySyncMutation.isPending}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#F97316",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 80,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {retrySyncMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>Réessayer</Text>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* Description */}
        {group.description ? (
          <View className="px-5 mb-4">
            <Text className="text-muted text-sm">{group.description}</Text>
          </View>
        ) : null}

        {/* RSVP */}
        <View className="px-5 mb-5">
          <Text className="text-foreground font-bold mb-3">Votre réponse</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["present", "absent", "maybe"] as const).map((rsvp) => {
              const config = RSVP_CONFIG[rsvp];
              const isActive = myMember?.rsvp === rsvp;
              return (
                <Pressable
                  key={rsvp}
                  onPress={() => handleRsvp(rsvp)}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: isActive ? config.color + "20" : colors.surface,
                      borderWidth: 2,
                      borderColor: isActive ? config.color : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{config.emoji}</Text>
                  <Text style={{ fontWeight: "600", fontSize: 12, color: isActive ? config.color : colors.foreground }}>
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* RSVP Summary - Clickable to expand */}
          <Pressable
            onPress={() => setShowRsvpList(!showRsvpList)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 10,
                gap: 16,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: colors.surface,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "600" }}>✅ {presentCount}</Text>
            <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "600" }}>❌ {absentCount}</Text>
            <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "600" }}>🤔 {maybeCount}</Text>
            <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "600" }}>⏳ {pendingCount}</Text>
            <IconSymbol name={showRsvpList ? "chevron.up" : "chevron.down"} size={14} color={colors.muted} />
          </Pressable>
        </View>

        {/* RSVP Detailed List */}
        {showRsvpList && (
          <View className="px-5 mb-5">
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {(["all", "present", "absent", "maybe", "pending"] as const).map((filter) => {
                const labels: Record<string, string> = {
                  all: "Tous",
                  present: `Présents (${presentCount})`,
                  absent: `Absents (${absentCount})`,
                  maybe: `Peut-être (${maybeCount})`,
                  pending: `En attente (${pendingCount})`,
                };
                const filterColors: Record<string, string> = {
                  all: colors.primary,
                  present: "#10B981",
                  absent: "#EF4444",
                  maybe: "#F59E0B",
                  pending: "#6B7280",
                };
                const isActive = rsvpFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setRsvpFilter(filter)}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: isActive ? filterColors[filter] + "20" : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? filterColors[filter] : colors.border,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={{ color: isActive ? filterColors[filter] : colors.muted, fontSize: 11, fontWeight: "600" }}>
                      {labels[filter]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {filteredMembers.map((member) => {
              const rsvpConfig = RSVP_CONFIG[member.rsvp];
              const isMe = member.id === (state.profile?.id || "user_1");
              const isFriend = state.friends?.some((f) => f.id === member.id);
              const avatarColor = getAvatarColor(member.name);
              return (
                <View
                  key={member.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 10,
                    borderRadius: 12,
                    marginBottom: 4,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: avatarColor + "30",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: avatarColor, fontSize: 14 }}>
                      {member.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text className="text-foreground font-semibold text-sm">{member.name}</Text>
                      {member.role === "admin" && (
                        <View style={{ backgroundColor: colors.warning + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                          <Text style={{ color: colors.warning, fontSize: 9, fontWeight: "700" }}>ADMIN</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-muted text-xs">@{member.username}</Text>
                  </View>
                  {!isMe && !isFriend && (
                    <Pressable
                      onPress={() =>
                        dispatch({
                          type: "ADD_FRIEND",
                          payload: { id: member.id, name: member.name, username: member.username, avatar: member.avatar || "", status: "available", addedAt: new Date().toISOString() },
                        })
                      }
                      style={({ pressed }) => [
                        {
                          marginRight: 8,
                          width: 30, height: 30, borderRadius: 10,
                          backgroundColor: colors.primary + "15",
                          alignItems: "center", justifyContent: "center",
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <IconSymbol name="person.badge.plus" size={16} color={colors.primary} />
                    </Pressable>
                  )}
                  <View style={{ backgroundColor: rsvpConfig.color + "15", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ color: rsvpConfig.color, fontSize: 11, fontWeight: "600" }}>
                      {rsvpConfig.emoji} {rsvpConfig.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Modules Grid */}
        <View className="px-5 mb-5">
          <Text className="text-foreground font-bold mb-3">Modules</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {modules.map((mod) => (
              <Pressable
                key={mod.label}
                onPress={() => router.push(mod.route as any)}
                style={({ pressed }) => [
                  {
                    width: "31%",
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                ]}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: mod.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                  }}
                >
                  <IconSymbol name={mod.icon} size={22} color={mod.color} />
                  {mod.badge > 0 && (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        backgroundColor: colors.error,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "700" }}>{mod.badge > 9 ? "9+" : mod.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 12, textAlign: "center" }}>
                  {mod.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sondages */}
        <View className="px-5 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-foreground font-bold">Sondages</Text>
            <Pressable
              onPress={() => router.push(`/group/polls?groupId=${id}` as any)}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Voir tout</Text>
            </Pressable>
          </View>
          {state.polls.filter((p) => p.groupId === id).length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-muted text-sm">Aucun sondage pour le moment</Text>
            </View>
          ) : (
            state.polls
              .filter((p) => p.groupId === id)
              .slice(0, 2)
              .map((poll) => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
                return (
                  <View
                    key={poll.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text className="text-foreground font-semibold text-sm mb-3">{poll.question}</Text>
                    {poll.options.map((opt) => {
                      const pct = totalVotes > 0 ? (opt.votes.length / totalVotes) * 100 : 0;
                      const voted = opt.votes.includes(state.profile?.id || "");
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() =>
                            dispatch({
                              type: "VOTE_POLL",
                              payload: { pollId: poll.id, optionId: opt.id, userId: state.profile?.id || "user_1" },
                            })
                          }
                          style={({ pressed }) => [
                            {
                              marginBottom: 6,
                              borderRadius: 10,
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: voted ? colors.primary : colors.border,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <View
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${pct}%`,
                              backgroundColor: voted ? colors.primary + "20" : colors.border + "30",
                            }}
                          />
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
                            <Text style={{ color: voted ? colors.primary : colors.foreground, fontWeight: voted ? "700" : "500", fontSize: 13 }}>
                              {opt.text}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }}>{Math.round(pct)}%</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
          )}
        </View>

        {/* Invitation Code */}
        <View className="px-5 mb-5">
          <Text className="text-foreground font-bold mb-3">Inviter des amis</Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text className="text-muted text-xs mb-2">Code d'invitation</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text className="text-foreground font-bold text-lg">{group.invitationCode}</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (Platform.OS === "web") {
                    navigator.clipboard.writeText(group.invitationCode);
                    alert("Code copié !");
                  } else {
                    Alert.alert("Code d'invitation", group.invitationCode, [
                      { text: "Copier", onPress: () => {} },
                      { text: "Fermer", style: "cancel" },
                    ]);
                  }
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 10 }}>
                  <IconSymbol name="doc.on.doc" size={18} color="#FFF" />
                </View>
              </Pressable>
            </View>
            <Text className="text-muted text-xs mt-2">Partagez ce code avec vos amis pour qu'ils rejoignent la soirée</Text>
          </View>
        </View>

        {/* Leave / Cancel Actions */}
        <View className="px-5 mb-5" style={{ gap: 8 }}>
          {isAdmin ? (
            <Pressable
              onPress={handleCancelEvent}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.error + "10",
                  borderWidth: 1,
                  borderColor: colors.error + "40",
                  gap: 8,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14 }}>
                Annuler la soirée
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleLeaveGroup}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.error + "10",
                  borderWidth: 1,
                  borderColor: colors.error + "40",
                  gap: 8,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name="arrow.right.square" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14 }}>
                Quitter le groupe
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Edit Group Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800", flex: 1 }}>
                Modifier la soirée
              </Text>
              <Pressable onPress={() => setShowEditModal(false)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
              </Pressable>
            </View>
            {[
              { label: "Nom", value: editName, setter: setEditName, placeholder: "Nom de la soirée" },
              { label: "Description", value: editDesc, setter: setEditDesc, placeholder: "Description (optionnel)" },
              { label: "Date", value: editDate, setter: setEditDate, placeholder: "YYYY-MM-DD" },
              { label: "Heure", value: editTime, setter: setEditTime, placeholder: "HH:MM" },
              { label: "Lieu", value: editLocation, setter: setEditLocation, placeholder: "Lieu de la soirée" },
            ].map(({ label, value, setter, placeholder }) => (
              <View key={label}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>
                  {label.toUpperCase()}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.foreground,
                    fontSize: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
              </View>
            ))}
            <Pressable
              onPress={handleSaveEdit}
              disabled={updateGroupMutation.isPending}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  padding: 14,
                  alignItems: "center",
                  marginTop: 4,
                },
                (pressed || updateGroupMutation.isPending) && { opacity: 0.7 },
              ]}
            >
              {updateGroupMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

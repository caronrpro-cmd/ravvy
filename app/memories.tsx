import { useState } from "react";
import { Text, View, Pressable, ScrollView, FlatList, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system/next";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { formatDate } from "@/lib/helpers";

export default function MemoriesScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPhoto = async (photo: { id: string; uri: string }) => {
    if (Platform.OS === "web") {
      Alert.alert("Non disponible", "Le téléchargement n'est pas disponible sur le web.");
      return;
    }
    try {
      setDownloadingId(photo.id);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les paramètres.");
        return;
      }
      const ext = photo.uri.split(".").pop()?.split("?")[0] || "jpg";
      const file = new File(Paths.cache, `ravvy_${photo.id}.${ext}`);
      await File.downloadFileAsync(photo.uri, file);
      const asset = await MediaLibrary.createAssetAsync(file.uri);
      await MediaLibrary.createAlbumAsync("Ravvy", asset, false);
      Alert.alert("Téléchargé", "Photo enregistrée dans votre galerie.");
    } catch (err) {
      console.error("[Download] erreur", err);
      Alert.alert("Erreur", "Le téléchargement a échoué.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async (photos: Array<{ id: string; uri: string }>) => {
    for (const photo of photos) {
      await handleDownloadPhoto(photo);
    }
  };

  // Past groups (date is in the past)
  const pastGroups = state.groups
    .filter((g) => {
      const d = new Date(g.date);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getGroupStats = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    const photos = state.photos.filter((p) => p.groupId === groupId);
    const expenses = state.expenses.filter((e) => e.groupId === groupId);
    const messages = state.chatMessages.filter((m) => m.groupId === groupId);
    const tasks = state.tasks.filter((t) => t.groupId === groupId);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const presentCount = group?.members.filter((m) => m.rsvp === "present").length || 0;

    return {
      photos: photos.length,
      expenses: totalExpenses,
      messages: messages.length,
      tasks: tasks.length,
      tasksCompleted: tasks.filter((t) => t.completed).length,
      participants: group?.members.length || 0,
      present: presentCount,
    };
  };

  const getGroupPhotos = (groupId: string) => {
    return state.photos.filter((p) => p.groupId === groupId);
  };

  const handleRecreate = (groupId: string) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;

    const newGroup = {
      ...group,
      id: generateId(),
      date: "",
      time: "",
      createdAt: new Date().toISOString(),
      members: group.members.map((m) => ({ ...m, rsvp: "pending" as const })),
    };

    dispatch({ type: "ADD_GROUP", payload: newGroup });
    dispatch({
      type: "ADD_NOTIFICATION",
      payload: {
        id: generateId(),
        type: "reminder" as const,
        title: "Soirée recréée",
        message: `"${group.name}" a été recréée. N'oubliez pas de définir la date !`,
        groupId: newGroup.id,
        read: false,
        createdAt: new Date().toISOString(),
      },
    });
    router.push(`/group/${newGroup.id}` as any);
  };

  const detail = selectedGroup ? state.groups.find((g) => g.id === selectedGroup) : null;
  const detailStats = selectedGroup ? getGroupStats(selectedGroup) : null;
  const detailPhotos = selectedGroup ? getGroupPhotos(selectedGroup) : [];

  if (detail && detailStats) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
            <Pressable onPress={() => setSelectedGroup(null)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </Pressable>
            <Text className="text-foreground text-lg font-bold" style={{ flex: 1 }} numberOfLines={1}>
              {detail.name}
            </Text>
          </View>

          {/* Banner */}
          <View className="px-5 mb-4">
            <View
              style={{
                height: 140,
                borderRadius: 20,
                backgroundColor: colors.primary,
                justifyContent: "flex-end",
                padding: 16,
                overflow: "hidden",
              }}
            >
              {detail.coverImage ? (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  <Image
                    source={{ uri: detail.coverImage }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
                </View>
              ) : null}
              <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "800" }}>{detail.name}</Text>
              <Text style={{ color: "#FFFFFFCC", fontSize: 12, marginTop: 2 }}>
                {formatDate(detail.date)} - {detail.location}
              </Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View className="px-5 mb-5">
            <Text className="text-foreground font-bold mb-3">Statistiques</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Participants", value: `${detailStats.participants}`, icon: "person.2.fill" as const, color: colors.primary },
                { label: "Présents", value: `${detailStats.present}`, icon: "checkmark.circle.fill" as const, color: "#10B981" },
                { label: "Photos", value: `${detailStats.photos}`, icon: "photo.fill" as const, color: "#EC4899" },
                { label: "Messages", value: `${detailStats.messages}`, icon: "bubble.left.fill" as const, color: "#06B6D4" },
                { label: "Dépenses", value: `${detailStats.expenses.toFixed(2)}€`, icon: "cart.fill" as const, color: "#F59E0B" },
                { label: "Tâches", value: `${detailStats.tasksCompleted}/${detailStats.tasks}`, icon: "checkmark.circle.fill" as const, color: "#F59E0B" },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    width: "31%",
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    padding: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: stat.color + "15",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 6,
                    }}
                  >
                    <IconSymbol name={stat.icon} size={18} color={stat.color} />
                  </View>
                  <Text className="text-foreground font-bold text-base">{stat.value}</Text>
                  <Text className="text-muted text-xs mt-1">{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Photos Gallery */}
          {detailPhotos.length > 0 && (
            <View className="px-5 mb-5">
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text className="text-foreground font-bold">Photos ({detailPhotos.length})</Text>
                <Pressable
                  onPress={() => handleDownloadAll(detailPhotos)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row", alignItems: "center", gap: 4,
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
                      backgroundColor: colors.primary + "15",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <IconSymbol name="arrow.down.circle.fill" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Tout télécharger</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {detailPhotos.map((photo) => (
                  <View key={photo.id} style={{ width: "32%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" }}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      transition={200}
                    />
                    <Pressable
                      onPress={() => handleDownloadPhoto(photo)}
                      style={{
                        position: "absolute", bottom: 4, right: 4,
                        backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8,
                        padding: 4,
                      }}
                    >
                      <IconSymbol
                        name={downloadingId === photo.id ? "arrow.down.circle" : "arrow.down.circle.fill"}
                        size={16}
                        color="#FFF"
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Members */}
          <View className="px-5 mb-5">
            <Text className="text-foreground font-bold mb-3">Membres</Text>
            {detail.members.map((member) => (
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
                    backgroundColor: colors.primary + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 14 }}>
                    {member.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-foreground font-semibold text-sm">{member.name}</Text>
                  <Text className="text-muted text-xs">@{member.username}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {member.rsvp === "present" ? "✅" : member.rsvp === "absent" ? "❌" : member.rsvp === "maybe" ? "🤔" : "⏳"}
                </Text>
              </View>
            ))}
          </View>

          {/* Recreate button */}
          <View className="px-5 mb-5">
            <Pressable
              onPress={() => handleRecreate(detail.id)}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  gap: 8,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="arrow.counterclockwise" size={18} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                Recréer cet événement
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(`/group/bilan?groupId=${detail.id}` as any)}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: "#F59E0B" + "15",
                  borderWidth: 1,
                  borderColor: "#F59E0B" + "40",
                  gap: 8,
                  marginTop: 10,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name="chart.bar.fill" size={18} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 15 }}>
                Voir le bilan
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Souvenirs</Text>
        </View>

        {pastGroups.length === 0 ? (
          <View className="px-5 items-center" style={{ paddingTop: 80 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: "#EC4899" + "15",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconSymbol name="clock.fill" size={30} color="#EC4899" />
            </View>
            <Text className="text-foreground text-lg font-bold mb-2">Pas encore de souvenirs</Text>
            <Text className="text-muted text-sm text-center">
              Vos soirées passées apparaîtront ici avec leurs photos et statistiques.
            </Text>
          </View>
        ) : (
          <View className="px-5">
            {pastGroups.map((group) => {
              const stats = getGroupStats(group.id);
              const photos = getGroupPhotos(group.id);
              return (
                <Pressable
                  key={group.id}
                  onPress={() => setSelectedGroup(group.id)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      marginBottom: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {/* Cover */}
                  <View style={{ height: 100, backgroundColor: colors.primary, justifyContent: "flex-end", padding: 12 }}>
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
                    <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "800" }}>{group.name}</Text>
                    <Text style={{ color: "#FFFFFFCC", fontSize: 11, marginTop: 2 }}>
                      {formatDate(group.date)} - {group.location}
                    </Text>
                  </View>

                  {/* Stats row */}
                  <View style={{ flexDirection: "row", padding: 12, gap: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="person.2.fill" size={14} color={colors.muted} />
                      <Text className="text-muted text-xs">{stats.participants}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="photo.fill" size={14} color={colors.muted} />
                      <Text className="text-muted text-xs">{stats.photos}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="bubble.left.fill" size={14} color={colors.muted} />
                      <Text className="text-muted text-xs">{stats.messages}</Text>
                    </View>
                    {stats.expenses > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <IconSymbol name="cart.fill" size={14} color={colors.muted} />
                        <Text className="text-muted text-xs">{stats.expenses.toFixed(0)}€</Text>
                      </View>
                    )}
                  </View>

                  {/* Photo preview */}
                  {photos.length > 0 && (
                    <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingBottom: 12, gap: 4 }}>
                      {photos.slice(0, 4).map((photo, idx) => (
                        <View key={photo.id} style={{ width: 50, height: 50, borderRadius: 8, overflow: "hidden" }}>
                          <Image
                            source={{ uri: photo.uri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                        </View>
                      ))}
                      {photos.length > 4 && (
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 8,
                            backgroundColor: colors.primary + "20",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>
                            +{photos.length - 4}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

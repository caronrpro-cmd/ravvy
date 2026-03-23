import { useEffect, useMemo, useState, useCallback } from "react";
import { Text, View, FlatList, Pressable, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { formatDate, getTimeRemaining } from "@/lib/helpers";
import { getAvatarColor } from "@/lib/avatar-color";
import { trpc } from "@/lib/trpc";

export default function HomeScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const groupsQuery = trpc.groups.list.useQuery(undefined, { enabled: false });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await groupsQuery.refetch(); } finally { setRefreshing(false); }
  }, [groupsQuery]);

  // Redirect to onboarding if not authenticated — delayed to let Root Layout mount first
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!isReady) return;
    if (!state.profile && !state.onboardingComplete) {
      router.replace("/onboarding" as any);
    }
  }, [state.profile, state.onboardingComplete, isReady]);

  const upcomingGroups = useMemo(
    () => [...state.groups]
      .filter((g) => new Date(g.date) > new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [state.groups]
  );

  const unreadNotifs = useMemo(
    () => state.notifications.filter((n) => !n.read).length,
    [state.notifications]
  );

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View>
            <Text className="text-muted text-sm">Bonjour 👋</Text>
            <Text className="text-foreground text-2xl font-bold">
              {state.profile?.name || "Utilisateur"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/notifications" as any)}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="bell.fill" size={22} color={colors.foreground} />
            {unreadNotifs > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.error,
                }}
              />
            )}
          </Pressable>
        </View>

        {/* Prochaines soirées */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-bold px-5 mb-3">
            Prochaines soirées
          </Text>
          {upcomingGroups.length === 0 ? (
            <View className="mx-5 bg-surface rounded-2xl p-6 items-center border border-border">
              <IconSymbol name="plus.circle.fill" size={40} color={colors.muted} />
              <Text className="text-muted mt-2 text-center">
                Aucune soirée prévue.{"\n"}Créez-en une !
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {upcomingGroups.slice(0, 5).map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}` as any)}
                  style={({ pressed }) => [
                    {
                      width: 260,
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: group.syncStatus === "failed" ? "#F97316" : colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {/* Gradient-like header */}
                  <View
                    style={{
                      height: 80,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      marginBottom: 12,
                      justifyContent: "flex-end",
                      padding: 10,
                    }}
                  >
                    {/* Badge sync échoué */}
                    {group.syncStatus === "failed" && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          backgroundColor: "#F97316",
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>⚠ Non sync.</Text>
                      </View>
                    )}
                    {group.syncStatus === "pending" && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          backgroundColor: "#6B7280",
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>⏳ Sync…</Text>
                      </View>
                    )}
                    {group.type === "auto-destruct" && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: "#F97316",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <IconSymbol name="timer" size={12} color="#FFF" />
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>
                          {getTimeRemaining(group.expiresAt!)}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "500" }}>
                      {formatDate(group.date)} · {group.time}
                    </Text>
                  </View>
                  <Text
                    className="text-foreground font-bold text-base"
                    numberOfLines={1}
                  >
                    {group.name}
                  </Text>
                  <Text className="text-muted text-xs mt-1" numberOfLines={1}>
                    📍 {group.location}
                  </Text>
                  <View className="flex-row items-center mt-2">
                    <View className="flex-row">
                      {group.members.slice(0, 3).map((m, i) => (
                        <View
                          key={m.id}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: getAvatarColor(m.name),
                            marginLeft: i > 0 ? -6 : 0,
                            borderWidth: 2,
                            borderColor: colors.surface,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "700" }}>
                            {m.name.charAt(0)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text className="text-muted text-xs ml-2">
                      {group.members.length} participants
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Quick Actions */}
        <View className="px-5 mb-6">
          <Text className="text-foreground text-lg font-bold mb-3">Actions rapides</Text>
          <View className="gap-3">
            {/* First Row */}
            <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/create" as any)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="plus.circle.fill" size={28} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "600", marginTop: 6, fontSize: 13 }}>
                Nouvelle soirée
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/friends" as any)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="person.badge.plus" size={28} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Ajouter amis
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/ai-assistant" as any)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="sparkles" size={28} color={colors.warning} />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Assistant IA
              </Text>
            </Pressable>
            </View>
            {/* Second Row - Join by Code */}
            <Pressable
              onPress={() => router.push("/join-by-code" as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.primary,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="qrcode" size={28} color={colors.primary} />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Rejoindre via code
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tous les groupes */}
        <View className="px-5">
          <Text className="text-foreground text-lg font-bold mb-3">Mes groupes</Text>
          {state.groups.length === 0 ? (
            <View className="bg-surface rounded-2xl p-6 items-center border border-border">
              <Text className="text-muted text-center">Aucun groupe pour le moment</Text>
            </View>
          ) : (
            state.groups.map((group) => {
              const presentCount = group.members.filter((m) => m.rsvp === "present").length;
              return (
                <Pressable
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}` as any)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      backgroundColor: colors.primary + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>
                      {group.type === "auto-destruct" ? "⏳" : "🎉"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-foreground font-semibold text-base" numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text className="text-muted text-xs mt-1">
                      {formatDate(group.date)} · {presentCount}/{group.members.length} confirmés
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={colors.muted} />
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

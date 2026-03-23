import { useState, useEffect, useRef } from "react";
import { Text, View, Pressable, TextInput, FlatList, Alert, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { getAvatarColor } from "@/lib/avatar-color";

export default function FriendsScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the add search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(addQuery.trim()), 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [addQuery]);

  const searchQuery = trpc.friends.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const filteredFriends = state.friends.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddFriend = (user: { id: number; name: string | null; username: string | null; avatar: string | null; status: string | null }) => {
    const name = user.name ?? "";
    const username = user.username ?? "";
    const avatar = user.avatar ?? "";
    const exists = state.friends.find((f) => f.id === String(user.id));
    if (exists) {
      const msg = "Cet utilisateur est déjà dans vos amis";
      Platform.OS === "web" ? alert(msg) : Alert.alert("Info", msg);
      return;
    }
    dispatch({
      type: "ADD_FRIEND",
      payload: {
        id: String(user.id),
        name,
        username,
        avatar,
        status: (user.status as any) ?? "available",
        addedAt: new Date().toISOString(),
      },
    });
    dispatch({
      type: "ADD_NOTIFICATION",
      payload: {
        id: generateId(),
        type: "friend",
        title: "Ami ajouté",
        message: `${name} a été ajouté à vos amis`,
        read: false,
        createdAt: new Date().toISOString(),
      },
    });
    setAddQuery("");
    setDebouncedQuery("");
    setShowAdd(false);
  };

  const handleRemoveFriend = (friendId: string, friendName: string) => {
    const doRemove = () => dispatch({ type: "REMOVE_FRIEND", payload: friendId });
    if (Platform.OS === "web") {
      if (confirm(`Retirer ${friendName} de vos amis ?`)) doRemove();
    } else {
      Alert.alert("Retirer l'ami", `Voulez-vous retirer ${friendName} de vos amis ?`, [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    available: "#10B981",
    busy: "#EF4444",
    away: "#F59E0B",
    dnd: "#6B7280",
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-2xl font-bold">Amis</Text>
        </View>
        <Pressable
          onPress={() => setShowAdd(!showAdd)}
          style={({ pressed }) => [
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="plus" size={20} color="#FFF" />
        </Pressable>
      </View>

      {/* Add Friend Search */}
      {showAdd && (
        <View className="px-5 mb-3">
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
          >
            <Text className="text-foreground font-semibold mb-2">Rechercher un utilisateur</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.background,
                borderRadius: 10,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 8,
              }}
            >
              <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
              <TextInput
                placeholder="Nom ou @username..."
                placeholderTextColor={colors.muted}
                value={addQuery}
                onChangeText={setAddQuery}
                autoFocus
                style={{
                  flex: 1,
                  padding: 10,
                  color: colors.foreground,
                  fontSize: 14,
                }}
              />
              {searchQuery.isFetching && <ActivityIndicator size="small" color={colors.muted} />}
            </View>
            {debouncedQuery.length >= 2 && (
              <View style={{ gap: 4 }}>
                {searchQuery.data?.length === 0 && !searchQuery.isFetching && (
                  <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 8 }}>
                    Aucun utilisateur trouvé
                  </Text>
                )}
                {searchQuery.data?.map((user) => {
                  const userName = user.name ?? "";
                  const alreadyFriend = state.friends.some((f) => f.id === String(user.id));
                  const avatarColor = getAvatarColor(userName);
                  return (
                    <View
                      key={user.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: colors.background,
                        gap: 10,
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
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: avatarColor, fontSize: 14 }}>
                          {userName.charAt(0)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{userName}</Text>
                        {user.username && <Text style={{ color: colors.muted, fontSize: 11 }}>@{user.username}</Text>}
                      </View>
                      <Pressable
                        onPress={() => !alreadyFriend && handleAddFriend(user)}
                        disabled={alreadyFriend}
                        style={({ pressed }) => [
                          {
                            backgroundColor: alreadyFriend ? colors.border : colors.primary,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            opacity: alreadyFriend ? 0.5 : 1,
                          },
                          pressed && !alreadyFriend && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={{ color: alreadyFriend ? colors.muted : "#FFF", fontWeight: "600", fontSize: 12 }}>
                          {alreadyFriend ? "Déjà ami" : "Ajouter"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Tabs */}
      <View className="px-5 mb-3">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { key: "friends" as const, label: `Amis (${state.friends.length})` },
            { key: "requests" as const, label: `Demandes (${state.friendRequests.length})` },
          ].map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: tab === t.key ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: tab === t.key ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: tab === t.key ? "#FFF" : colors.foreground,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search */}
      {tab === "friends" && (
        <View className="px-5 mb-3">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
            <TextInput
              placeholder="Rechercher..."
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 8,
                color: colors.foreground,
                fontSize: 14,
              }}
            />
          </View>
        </View>
      )}

      {tab === "friends" ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View className="items-center py-12">
              <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
              <Text className="text-muted mt-3">Aucun ami trouvé</Text>
            </View>
          }
          renderItem={({ item: friend }) => {
            const avatarColor = getAvatarColor(friend.name);
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 6,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: avatarColor + "30",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: avatarColor, fontSize: 16 }}>
                    {friend.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text className="text-foreground font-semibold text-sm">{friend.name}</Text>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: STATUS_COLORS[friend.status] || "#6B7280",
                      }}
                    />
                  </View>
                  <Text className="text-muted text-xs">@{friend.username}</Text>
                </View>
                <Pressable
                  onPress={() => handleRemoveFriend(friend.id, friend.name)}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <IconSymbol name="xmark" size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={state.friendRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <IconSymbol name="person.badge.plus" size={48} color={colors.muted} />
              <Text className="text-muted mt-3">Aucune demande en attente</Text>
            </View>
          }
          renderItem={({ item: req }) => {
            const avatarColor = getAvatarColor(req.name);
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 6,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: avatarColor + "30",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: avatarColor, fontSize: 16 }}>
                    {req.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-foreground font-semibold text-sm">{req.name}</Text>
                  <Text className="text-muted text-xs">@{req.username}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    onPress={() => dispatch({ type: "ACCEPT_FRIEND_REQUEST", payload: req.id })}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.success,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 12 }}>Accepter</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => dispatch({ type: "REJECT_FRIEND_REQUEST", payload: req.id })}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.error + "20",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 12 }}>Refuser</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

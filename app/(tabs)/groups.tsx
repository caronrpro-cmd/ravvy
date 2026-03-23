import { useState, useMemo, useCallback } from "react";
import { Text, View, Pressable, TextInput, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { formatDate, getTimeRemaining } from "@/lib/helpers";
import { trpc } from "@/lib/trpc";

type Filter = "all" | "classic" | "auto-destruct";

export default function GroupsScreen() {
  const { state } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const groupsQuery = trpc.groups.list.useQuery(undefined, { enabled: false });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await groupsQuery.refetch(); } finally { setRefreshing(false); }
  }, [groupsQuery]);

  const filteredGroups = useMemo(
    () => state.groups.filter((g) => {
      if (filter !== "all" && g.type !== filter) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [state.groups, filter, search]
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "classic", label: "Classiques" },
    { key: "auto-destruct", label: "Temporaires" },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-3">
        <Text className="text-foreground text-2xl font-bold">Groupes</Text>
      </View>

      {/* Search */}
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
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            placeholder="Rechercher un groupe..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              color: colors.foreground,
              fontSize: 15,
            }}
          />
        </View>
      </View>

      {/* Filters */}
      <View className="px-5 mb-4">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {filters.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: filter === f.key ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: filter === f.key ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: filter === f.key ? "#FFF" : colors.foreground,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Group List */}
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="person.3.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-3 text-center">
              Aucun groupe trouvé
            </Text>
          </View>
        }
        renderItem={useCallback(({ item: group }: { item: (typeof filteredGroups)[number] }) => {
          const presentCount = group.members.filter((m) => m.rsvp === "present").length;
          return (
            <Pressable
              onPress={() => router.push(`/group/${group.id}` as any)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: group.type === "auto-destruct" ? "#F9731620" : colors.primary + "20",
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text className="text-foreground font-bold text-base" numberOfLines={1} style={{ flex: 1 }}>
                      {group.name}
                    </Text>
                    {group.type === "auto-destruct" && (
                      <View
                        style={{
                          backgroundColor: "#F97316",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <IconSymbol name="timer" size={10} color="#FFF" />
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "600" }}>
                          {getTimeRemaining(group.expiresAt!)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted text-xs mt-1">
                    {formatDate(group.date)} · {group.location}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="person.2.fill" size={14} color={colors.muted} />
                      <Text className="text-muted text-xs">{group.members.length}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <IconSymbol name="checkmark" size={14} color={colors.success} />
                      <Text style={{ color: colors.success, fontSize: 12 }}>{presentCount} confirmés</Text>
                    </View>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </Pressable>
          );
        }, [colors, router])}
      />
    </ScreenContainer>
  );
}

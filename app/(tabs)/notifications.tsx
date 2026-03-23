import { useCallback, useState } from "react";
import { Text, View, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { formatRelativeTime } from "@/lib/helpers";

const NOTIF_ICONS: Record<string, { icon: any; color: string }> = {
  rsvp: { icon: "questionmark.circle.fill", color: "#F59E0B" },
  task: { icon: "checkmark.circle.fill", color: "#F59E0B" },
  carpool: { icon: "car.fill", color: "#3B82F6" },
  expense: { icon: "dollarsign.circle.fill", color: "#10B981" },
  reminder: { icon: "clock.fill", color: "#6366F1" },
  destruct: { icon: "timer", color: "#F97316" },
  friend: { icon: "person.badge.plus", color: "#EC4899" },
  chat: { icon: "bubble.left.fill", color: "#06B6D4" },
};

export default function NotificationsScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);

  const handleClearAll = () => {
    dispatch({ type: "CLEAR_NOTIFICATIONS" });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 400));
    setRefreshing(false);
  }, []);

  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text className="text-foreground text-2xl font-bold">Notifications</Text>
        {state.notifications.some((n) => !n.read) && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
              Tout marquer lu
            </Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={state.notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <IconSymbol name="bell.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-3 text-center">
              Aucune notification
            </Text>
          </View>
        }
        renderItem={useCallback(({ item: notif }: { item: (typeof state.notifications)[number] }) => {
          const config = NOTIF_ICONS[notif.type] || NOTIF_ICONS.reminder;
          return (
            <Pressable
              onPress={() => {
                dispatch({ type: "MARK_NOTIFICATION_READ", payload: notif.id });
                if (notif.groupId) {
                  router.push(`/group/${notif.groupId}` as any);
                }
              }}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: 8,
                  backgroundColor: notif.read ? colors.surface : colors.primary + "08",
                  borderWidth: 1,
                  borderColor: notif.read ? colors.border : colors.primary + "30",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: config.color + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <IconSymbol name={config.icon} size={20} color={config.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  className="text-foreground font-semibold text-sm"
                  numberOfLines={1}
                >
                  {notif.title}
                </Text>
                <Text className="text-muted text-xs mt-1" numberOfLines={2}>
                  {notif.message}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                  {formatRelativeTime(notif.createdAt)}
                </Text>
              </View>
              {!notif.read && (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                    marginLeft: 8,
                    alignSelf: "center",
                  }}
                />
              )}
            </Pressable>
          );
        }, [colors, dispatch, router])}
      />
    </ScreenContainer>
  );
}

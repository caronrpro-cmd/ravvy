import { useState } from "react";
import { Text, View, Pressable, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import Constants from "expo-constants";

export default function SettingsScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();

  const isDark = state.darkMode === true;
  const [pushEnabled, setPushEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [tasksEnabled, setTasksEnabled] = useState(true);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-2xl font-bold">Paramètres</Text>
        </View>

        {/* Apparence */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs font-semibold uppercase mb-3 tracking-wider">
            Apparence
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#6366F1" + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <IconSymbol name={isDark ? "moon.fill" : "sun.max.fill"} size={18} color="#6366F1" />
              </View>
              <Text className="text-foreground font-semibold text-sm" style={{ flex: 1 }}>
                Mode sombre
              </Text>
              <Switch
                value={isDark}
                onValueChange={(val) => dispatch({ type: "SET_DARK_MODE", payload: val })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs font-semibold uppercase mb-3 tracking-wider">
            Notifications
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {[
              { label: "Notifications push", value: pushEnabled, onChange: setPushEnabled },
              { label: "Rappels de soirée", value: remindersEnabled, onChange: setRemindersEnabled },
              { label: "Messages de chat", value: chatEnabled, onChange: setChatEnabled },
              { label: "Mises à jour de tâches", value: tasksEnabled, onChange: setTasksEnabled },
            ].map((item, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderTopWidth: i > 0 ? 0.5 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <Text className="text-foreground text-sm" style={{ flex: 1 }}>
                  {item.label}
                </Text>
                <Switch
                  value={item.value}
                  onValueChange={item.onChange}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFF"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Confidentialité */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs font-semibold uppercase mb-3 tracking-wider">
            Confidentialité & Sécurité
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {[
              { icon: "location.fill" as const, label: "Partage de localisation", color: "#10B981", onPress: undefined as any },
              { icon: "lock.fill" as const, label: "Données chiffrées", color: "#6366F1", onPress: undefined as any },
              { icon: "trash.fill" as const, label: "Suppression RGPD", color: "#EF4444", onPress: () => router.push("/delete-account" as any) },
            ].map((item, i) => (
              <Pressable
                key={i}
                onPress={item.onPress}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderTopWidth: i > 0 ? 0.5 : 0,
                    borderTopColor: colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: item.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <IconSymbol name={item.icon} size={16} color={item.color} />
                </View>
                <Text className="text-foreground text-sm" style={{ flex: 1 }}>
                  {item.label}
                </Text>
                <IconSymbol name="chevron.right" size={14} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* À propos */}
        <View className="px-5 mb-6">
          <Text className="text-muted text-xs font-semibold uppercase mb-3 tracking-wider">
            À propos
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text className="text-foreground font-semibold">
                Ravvy v{Constants.expoConfig?.version ?? "1.0.0"}
              </Text>
              <Text className="text-muted text-xs mt-1">
                Application d'organisation de soirées entre amis.{"\n"}
                Conforme RGPD. Données chiffrées.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/legal/privacy" as any)}
              accessibilityLabel="Politique de confidentialité"
              accessibilityRole="button"
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>Politique de confidentialité</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/legal/terms" as any)}
              accessibilityLabel="Conditions d'utilisation"
              accessibilityRole="button"
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", padding: 14 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>Conditions d'utilisation</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

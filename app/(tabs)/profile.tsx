import { useState } from "react";
import { Text, View, Pressable, ScrollView, TextInput, Platform, Alert, ActivityIndicator, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { clearState } from "@/lib/storage";

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible", color: "#10B981", emoji: "🟢" },
  { value: "busy", label: "Occupé", color: "#EF4444", emoji: "🔴" },
  { value: "away", label: "Absent", color: "#F59E0B", emoji: "🟡" },
  { value: "dnd", label: "Ne pas déranger", color: "#6B7280", emoji: "⛔" },
] as const;

export default function ProfileScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(state.profile?.name || "");
  const [editBio, setEditBio] = useState(state.profile?.bio || "");
  const [editUsername, setEditUsername] = useState(state.profile?.username || "");

  const { user: authUser, isAuthenticated, loading: authLoading, logout } = useAuth();
  const profile = state.profile;
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === profile?.status) || STATUS_OPTIONS[0];

  const pastGroups = state.groups.filter((g) => new Date(g.date) < new Date());
  const upcomingGroups = state.groups.filter((g) => new Date(g.date) >= new Date());

  const [saving, setSaving] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const updateMutation = trpc.profile.update.useMutation();
  const utils = trpc.useUtils();

  const syncToBackend = async (updates: Parameters<typeof updateMutation.mutateAsync>[0]) => {
    try {
      await updateMutation.mutateAsync(updates);
      utils.profile.get.invalidate();
    } catch {
      // Silent — local state already updated; will retry on next session via useAuthSync
    }
  };

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        dispatch({ type: "UPDATE_PROFILE", payload: { avatar: uri } });
        syncToBackend({ avatar: uri });
      }
    } catch (e) {
      console.warn("ImagePicker error:", e);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") alert("Permission caméra refusée");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        dispatch({ type: "UPDATE_PROFILE", payload: { avatar: uri } });
        syncToBackend({ avatar: uri });
      }
    } catch (e) {
      console.warn("Camera error:", e);
    }
  };

  const handleSave = async () => {
    const name = editName.trim();
    const username = editUsername.trim();
    if (!name || !username) {
      Alert.alert("Erreur", "Le nom et le pseudo ne peuvent pas être vides.");
      return;
    }
    const updates = { name, username, bio: editBio.trim() };
    setSaving(true);
    try {
      await updateMutation.mutateAsync(updates);
      dispatch({ type: "UPDATE_PROFILE", payload: updates });
      utils.profile.get.invalidate();
      setEditing(false);
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = () => {
    const currentIdx = STATUS_OPTIONS.findIndex((s) => s.value === profile?.status);
    const nextIdx = (currentIdx + 1) % STATUS_OPTIONS.length;
    const newStatus = STATUS_OPTIONS[nextIdx].value;
    dispatch({ type: "UPDATE_PROFILE", payload: { status: newStatus } });
    syncToBackend({ status: newStatus });
  };

  const queryClient = useQueryClient();

const handleLogout = async () => {
  await logout();
  queryClient.clear();
  await clearState();
  dispatch({ type: "LOGOUT" });
};

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-2 pb-4">
          <Text className="text-foreground text-2xl font-bold">Profil</Text>
        </View>

        {/* Profile Card */}
        <View className="px-5 mb-6">
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 20,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {/* Avatar with ImagePicker */}
            <Pressable
              onPress={handlePickAvatar}
              onLongPress={handleTakePhoto}
              style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            >
              <View style={{ position: "relative" }}>
                {profile?.avatar ? (
                  <Image
                    source={{ uri: profile.avatar }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      marginBottom: 12,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 32, fontWeight: "700" }}>
                      {profile?.name?.charAt(0) || "?"}
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: -4,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <IconSymbol name="camera.fill" size={13} color="#FFF" />
                </View>
              </View>
            </Pressable>
            <Text className="text-muted text-xs mb-2">Appuyez pour changer la photo</Text>

            {editing ? (
              <View style={{ width: "100%", gap: 10 }}>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nom"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.foreground,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: colors.border,
                    textAlign: "center",
                  }}
                />
                <TextInput
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.foreground,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: colors.border,
                    textAlign: "center",
                  }}
                />
                <TextInput
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Bio"
                  placeholderTextColor={colors.muted}
                  multiline
                  returnKeyType="done"
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.foreground,
                    fontSize: 15,
                    borderWidth: 1,
                    borderColor: colors.border,
                    textAlign: "center",
                    minHeight: 60,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Pressable
                    onPress={() => setEditing(false)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: colors.background,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: colors.primary,
                        alignItems: "center",
                        opacity: saving ? 0.7 : 1,
                      },
                      pressed && !saving && { opacity: 0.7 },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={{ color: "#FFF", fontWeight: "600" }}>Sauvegarder</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text className="text-foreground text-xl font-bold">{profile?.name}</Text>
                <Text className="text-muted text-sm">@{profile?.username}</Text>
                <Text className="text-muted text-sm mt-2 text-center">{profile?.bio}</Text>

                {/* Status */}
                <Pressable
                  onPress={handleStatusChange}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: currentStatus.color + "15",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text>{currentStatus.emoji}</Text>
                  <Text style={{ color: currentStatus.color, fontWeight: "600", fontSize: 13 }}>
                    {currentStatus.label}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setEditName(profile?.name || "");
                    setEditBio(profile?.bio || "");
                    setEditUsername(profile?.username || "");
                    setEditing(true);
                  }}
                  style={({ pressed }) => [
                    {
                      marginTop: 14,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: colors.primary + "15",
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                    Modifier le profil
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Stats */}
        <View className="px-5 mb-6">
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-foreground text-2xl font-bold">{state.friends.length}</Text>
              <Text className="text-muted text-xs mt-1">Amis</Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-foreground text-2xl font-bold">{state.groups.length}</Text>
              <Text className="text-muted text-xs mt-1">Groupes</Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-foreground text-2xl font-bold">{upcomingGroups.length}</Text>
              <Text className="text-muted text-xs mt-1">À venir</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-5">
          {[
            { icon: "person.2.fill" as const, label: "Mes amis", route: "/friends" as string | null, color: colors.primary, onPress: undefined as (() => void) | undefined },
            { icon: "clock.fill" as const, label: "Souvenirs", route: "/memories" as string | null, color: "#EC4899", onPress: undefined as (() => void) | undefined },
            { icon: "qrcode" as const, label: "Mon QR Code", route: null as string | null, color: "#06B6D4", onPress: () => setQrModalVisible(true) },
            { icon: "gear" as const, label: "Paramètres", route: "/settings" as string | null, color: colors.muted, onPress: undefined as (() => void) | undefined },
            { icon: "sparkles" as const, label: "Assistant IA", route: "/ai-assistant" as string | null, color: "#F59E0B", onPress: undefined as (() => void) | undefined },
          ].map((item, i) => (
            <Pressable
              key={i}
              onPress={() => { if (item.onPress) { item.onPress(); } else if (item.route) { router.push(item.route as any); } }}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: 6,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: item.color + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <IconSymbol name={item.icon} size={18} color={item.color} />
              </View>
              <Text className="text-foreground font-semibold text-sm" style={{ flex: 1 }}>
                {item.label}
              </Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {/* QR Code Modal */}
        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQrModalVisible(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}
            onPress={() => setQrModalVisible(false)}
          >
            <Pressable
              style={{
                backgroundColor: colors.surface,
                borderRadius: 20,
                padding: 28,
                alignItems: "center",
                width: 280,
              }}
              onPress={() => {}}
            >
              <Text className="text-foreground text-lg font-bold mb-1">Mon QR Code</Text>
              <Text className="text-muted text-xs mb-5 text-center">
                Partagez votre profil avec vos amis
              </Text>
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 16,
                  backgroundColor: colors.primary + "10",
                  borderWidth: 1,
                  borderColor: colors.primary + "30",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <IconSymbol name="qrcode" size={80} color={colors.primary} />
              </View>
              <Text className="text-foreground font-bold text-base">@{profile?.username}</Text>
              <Text className="text-muted text-xs mt-1 mb-5">{profile?.name}</Text>
              <Pressable
                onPress={() => setQrModalVisible(false)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 24,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>Fermer</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Auth Section */}
        <View className="px-5 mt-4">
          {isAuthenticated ? (
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: "#EF4444" + "10",
                  borderWidth: 1,
                  borderColor: "#EF4444" + "30",
                  justifyContent: "center",
                  gap: 8,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="xmark.circle.fill" size={18} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 14 }}>Se déconnecter</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/login')}
              disabled={authLoading}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.primary + "15",
                  borderWidth: 1,
                  borderColor: colors.primary + "30",
                  justifyContent: "center",
                  gap: 8,
                  opacity: authLoading ? 0.5 : 1,
                },
                pressed && !authLoading && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="person.fill" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Se connecter pour synchroniser</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

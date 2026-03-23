import { useState } from "react";
import { Text, View, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/lib/toast-context";

export default function JoinByCodeScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { showError } = useToast();

  const joinByCode = trpc.groups.joinByCode.useMutation();

  const handleJoinGroup = async () => {
    if (!code.trim()) {
      showError("Veuillez entrer un code d'invitation");
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    setLoading(true);
    try {
      const group = await joinByCode.mutateAsync({ shareCode: normalizedCode });

      const members = (group.members ?? []).map((m: any) => ({
        id: String(m.userId),
        name: m.name || "Inconnu",
        username: m.username || "",
        avatar: m.avatar || "",
        rsvp: (m.rsvp as "present" | "absent" | "maybe" | "pending") || "pending",
        role: (m.role as "admin" | "member") || "member",
      }));

      dispatch({
        type: "ADD_GROUP",
        payload: {
          id: group.externalId,
          name: group.name,
          description: group.description || "",
          type: (group.type as "classic" | "auto-destruct") || "classic",
          date: group.date || "",
          time: group.time || "",
          location: group.location || "",
          members,
          coverImage: group.coverImage || "",
          createdBy: group.createdBy.toString(),
          createdAt: group.createdAt?.toString() || new Date().toISOString(),
          invitationCode: group.shareCode || normalizedCode,
        },
      });

      router.push(`/group/${group.externalId}` as any);
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.shape?.message ||
        err?.message ||
        "Code d'invitation invalide ou expiré";
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
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
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-2xl font-bold flex-1 ml-4">
            Rejoindre une soirée
          </Text>
        </View>

        {/* Info Section */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
          <View className="flex-row gap-3">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="text-foreground text-sm flex-1">
              Entrez le code d'invitation fourni par l'organisateur de la soirée pour la rejoindre.
            </Text>
          </View>
        </View>

        {/* Code Input */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Code d'invitation</Text>
          <TextInput
            placeholder="Ex: PARTY2024"
            placeholderTextColor={colors.muted}
            value={code}
            onChangeText={setCode}
            editable={!loading}
            autoCapitalize="characters"
            maxLength={12}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: colors.foreground,
              fontWeight: "600",
              letterSpacing: 2,
            }}
          />
          <Text className="text-muted text-xs mt-2">
            {code.length}/12 caractères
          </Text>
        </View>

        {/* Join Button */}
        <Pressable
          onPress={handleJoinGroup}
          disabled={loading || !code.trim()}
          style={({ pressed }) => [
            {
              backgroundColor: code.trim() ? colors.primary : colors.muted,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              opacity: loading ? 0.7 : 1,
            },
            pressed && code.trim() && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text
            style={{
              color: "#FFF",
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            {loading ? "Vérification..." : "Rejoindre"}
          </Text>
        </Pressable>

        {/* Example Section */}
        <View className="mt-8 pt-6 border-t border-border">
          <Text className="text-muted text-sm font-semibold mb-3">Exemple d'utilisation :</Text>
          <View className="bg-surface rounded-xl p-4 gap-2">
            <Text className="text-foreground text-sm">
              1. L'organisateur partage un code (ex: <Text className="font-mono">PARTY2024</Text>)
            </Text>
            <Text className="text-foreground text-sm">
              2. Vous entrez le code ci-dessus
            </Text>
            <Text className="text-foreground text-sm">
              3. Vous êtes automatiquement ajouté au groupe
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

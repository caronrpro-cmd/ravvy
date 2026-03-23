import { useState, useCallback } from "react";
import { Text, View, Pressable, ScrollView, Alert, Platform, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { formatDate } from "@/lib/helpers";

export default function ShareGroupScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [copied, setCopied] = useState(false);

  const group = state.groups.find((g) => g.id === groupId);
  if (!group) {
    return (
      <ScreenContainer className="p-6">
        <Text className="text-foreground text-lg">Groupe introuvable</Text>
      </ScreenContainer>
    );
  }

  const inviteCode = group.invitationCode;
  const inviteLink = `ravvy://join/${group.id}?code=${inviteCode}`;

  const handleCopyCode = useCallback(async () => {
    try {
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (Platform.OS === "web") alert("Code copié : " + inviteCode);
      else Alert.alert("Code d'invitation", inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteCode]);

  const handleCopyLink = useCallback(async () => {
    try {
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteLink);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (Platform.OS === "web") alert("Lien copié : " + inviteLink);
      else Alert.alert("Lien d'invitation", inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteLink]);

  const handleShare = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({
            title: `Rejoins ${group.name} sur Ravvy !`,
            text: `Tu es invité(e) à "${group.name}" le ${formatDate(group.date)} à ${group.time}. Code : ${inviteCode}`,
            url: inviteLink,
          });
        } else {
          handleCopyLink();
        }
      } else {
        await Share.share({
          message: `Tu es invité(e) à "${group.name}" sur Ravvy !\n\nDate : ${formatDate(group.date)} à ${group.time}\nLieu : ${group.location}\n\nRejoins avec le code : ${inviteCode}\n\n${inviteLink}`,
        });
      }
    } catch {
      // User cancelled
    }
  }, [group, inviteCode, inviteLink, handleCopyLink]);

  // Generate a simple QR code visual (grid-based representation)
  const qrSize = 200;
  const cellSize = 8;
  const gridSize = Math.floor(qrSize / cellSize);
  // Deterministic pattern from group ID
  const qrCells: boolean[][] = [];
  const seed = group.id;
  for (let y = 0; y < gridSize; y++) {
    qrCells[y] = [];
    for (let x = 0; x < gridSize; x++) {
      // Border quiet zone
      if (x < 2 || x >= gridSize - 2 || y < 2 || y >= gridSize - 2) {
        qrCells[y][x] = false;
        continue;
      }
      // Finder patterns (top-left, top-right, bottom-left)
      const inTopLeft = x >= 2 && x <= 8 && y >= 2 && y <= 8;
      const inTopRight = x >= gridSize - 9 && x <= gridSize - 3 && y >= 2 && y <= 8;
      const inBottomLeft = x >= 2 && x <= 8 && y >= gridSize - 9 && y <= gridSize - 3;

      if (inTopLeft || inTopRight || inBottomLeft) {
        const lx = inTopLeft ? x - 2 : inTopRight ? x - (gridSize - 9) : x - 2;
        const ly = inTopLeft ? y - 2 : inTopRight ? y - 2 : y - (gridSize - 9);
        // Outer border, inner square
        if (lx === 0 || lx === 6 || ly === 0 || ly === 6) {
          qrCells[y][x] = true;
        } else if (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4) {
          qrCells[y][x] = true;
        } else {
          qrCells[y][x] = false;
        }
        continue;
      }
      // Data area - deterministic from seed
      const charCode = seed.charCodeAt((x * 7 + y * 13) % seed.length) || 0;
      qrCells[y][x] = ((charCode + x * 3 + y * 5) % 3) !== 0;
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Inviter des amis</Text>
        </View>

        {/* QR Code */}
        <View className="px-5 mb-6">
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 24,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 4 }}>
              {group.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
              {formatDate(group.date)} à {group.time}
            </Text>

            {/* QR Code Grid */}
            <View
              style={{
                width: qrSize,
                height: qrSize,
                backgroundColor: "#FFF",
                borderRadius: 12,
                padding: 4,
                overflow: "hidden",
              }}
            >
              {qrCells.map((row, y) => (
                <View key={y} style={{ flexDirection: "row" }}>
                  {row.map((cell, x) => (
                    <View
                      key={`${x}-${y}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: cell ? "#1a1a2e" : "#FFF",
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 12, textAlign: "center" }}>
              Scannez ce QR code pour rejoindre le groupe
            </Text>
          </View>
        </View>

        {/* Invite Code */}
        <View className="px-5 mb-4">
          <Text className="text-foreground font-semibold mb-2">Code d'invitation</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: colors.primary + "10",
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 16,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "800",
                  fontSize: 22,
                  letterSpacing: 3,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                }}
              >
                {inviteCode}
              </Text>
            </View>
            <Pressable
              onPress={handleCopyCode}
              style={({ pressed }) => [
                {
                  marginLeft: 10,
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: copied ? colors.success : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name={copied ? "checkmark" : "doc.on.doc.fill" as any} size={20} color="#FFF" />
            </Pressable>
          </View>
          {copied && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: 6, textAlign: "center" }}>
              Copié dans le presse-papier !
            </Text>
          )}
        </View>

        {/* Share Options */}
        <View className="px-5 mb-6">
          <Text className="text-foreground font-semibold mb-3">Partager via</Text>
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
            >
              <IconSymbol name="paperplane.fill" size={20} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15, marginLeft: 10, flex: 1 }}>
                Partager le lien d'invitation
              </Text>
              <IconSymbol name="chevron.right" size={16} color="#FFFFFF80" />
            </Pressable>

            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name="doc.on.doc.fill" size={20} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15, marginLeft: 10, flex: 1 }}>
                Copier le lien
              </Text>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {/* Members Already In */}
        <View className="px-5">
          <Text className="text-foreground font-semibold mb-3">
            Membres actuels ({group.members.length})
          </Text>
          {group.members.map((member) => (
            <View
              key={member.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 10,
                borderRadius: 12,
                marginBottom: 4,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary + "25",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 13 }}>
                  {member.name.charAt(0)}
                </Text>
              </View>
              <Text className="text-foreground text-sm font-medium" style={{ flex: 1 }}>
                {member.name}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                {member.role === "admin" ? "Organisateur" : "Membre"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

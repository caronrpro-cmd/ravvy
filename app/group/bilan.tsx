import { useState, useMemo } from "react";
import { Text, View, Pressable, ScrollView, Share, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { formatDate } from "@/lib/helpers";
import { toCents, toEuros, formatEuros, calculateDebts, type DebtResult } from "@/lib/money";


export default function BilanScreen() {
  const { state } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState<"summary" | "debts" | "photos">("summary");

  const group = state.groups.find((g) => g.id === groupId);
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

  const expenses = state.expenses.filter((e) => e.groupId === groupId);
  const photos = state.photos.filter((p) => p.groupId === groupId);
  const messages = state.chatMessages.filter((m) => m.groupId === groupId);
  const tasks = state.tasks.filter((t) => t.groupId === groupId);
  const shoppingItems = state.shoppingItems.filter((i) => i.groupId === groupId);

  const totalExpensesCents = expenses.reduce((sum, e) => sum + toCents(e.amount), 0);
  const presentMembers = group.members.filter((m) => m.rsvp === "present");
  const completedTasks = tasks.filter((t) => t.completed);

  // Calculate debts (tricount) — all arithmetic in integer cents to avoid float errors
  const debts = useMemo(
    () => calculateDebts(expenses, group.members),
    [expenses, group.members]
  );

  const handleShare = async () => {
    const summary = [
      `Bilan de "${group.name}"`,
      `Date : ${formatDate(group.date)}`,
      `Lieu : ${group.location}`,
      ``,
      `Participants : ${group.members.length} (${presentMembers.length} présents)`,
      `Messages : ${messages.length}`,
      `Photos : ${photos.length}`,
      `Tâches : ${completedTasks.length}/${tasks.length} complétées`,
      ``,
      `Dépenses totales : ${formatEuros(totalExpensesCents)}`,
    ];

    if (debts.length > 0) {
      summary.push(``, `Remboursements :`);
      debts.forEach((d) => {
        summary.push(`  ${d.fromName} doit ${formatEuros(d.amountCents)} à ${d.toName}`);
      });
    }

    const text = summary.join("\n");

    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(text);
        alert("Bilan copié dans le presse-papier !");
      } catch {
        alert(text);
      }
    } else {
      try {
        await Share.share({ message: text });
      } catch {
        // cancelled
      }
    }
  };

  const tabs = [
    { id: "summary" as const, label: "Résumé", icon: "chart.bar.fill" as const },
    { id: "debts" as const, label: "Dettes", icon: "cart.fill" as const },
    { id: "photos" as const, label: "Photos", icon: "photo.fill" as const },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-2">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text className="text-foreground text-lg font-bold">Bilan</Text>
            <Text className="text-muted text-xs">{group.name}</Text>
          </View>
          <Pressable
            onPress={handleShare}
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
        </View>

        {/* Tabs */}
        <View className="px-5 mb-4">
          <View style={{ flexDirection: "row", gap: 6, backgroundColor: colors.surface, borderRadius: 14, padding: 4 }}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: activeTab === tab.id ? colors.primary : "transparent",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <IconSymbol name={tab.icon} size={14} color={activeTab === tab.id ? "#FFF" : colors.muted} />
                <Text
                  style={{
                    color: activeTab === tab.id ? "#FFF" : colors.muted,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Tab */}
        {activeTab === "summary" && (
          <View className="px-5">
            {/* Big Stats */}
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 20,
                padding: 20,
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ color: "#FFFFFFCC", fontSize: 13, fontWeight: "600" }}>Dépenses totales</Text>
              <Text style={{ color: "#FFF", fontSize: 36, fontWeight: "800", marginTop: 4 }}>
                {formatEuros(totalExpensesCents)}
              </Text>
              <Text style={{ color: "#FFFFFFAA", fontSize: 12, marginTop: 4 }}>
                {expenses.length} dépenses - {group.members.length > 0 ? formatEuros(Math.round(totalExpensesCents / group.members.length)) : "0.00€"}/personne
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Participants", value: `${group.members.length}`, color: colors.primary },
                { label: "Présents", value: `${presentMembers.length}`, color: "#10B981" },
                { label: "Messages", value: `${messages.length}`, color: "#06B6D4" },
                { label: "Photos", value: `${photos.length}`, color: "#EC4899" },
                { label: "Tâches", value: `${completedTasks.length}/${tasks.length}`, color: "#F59E0B" },
                { label: "Courses", value: `${shoppingItems.filter((i) => i.status === "bought").length}/${shoppingItems.length}`, color: "#F59E0B" },
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
                  <Text style={{ color: stat.color, fontSize: 22, fontWeight: "800" }}>{stat.value}</Text>
                  <Text className="text-muted text-xs mt-1">{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Event Info */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-foreground font-bold mb-2">Détails de l'événement</Text>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name="calendar" size={14} color={colors.muted} />
                  <Text className="text-muted text-sm">{formatDate(group.date)} à {group.time}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <IconSymbol name="location.fill" size={14} color={colors.muted} />
                  <Text className="text-muted text-sm">{group.location}</Text>
                </View>
                {group.description ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <IconSymbol name="doc.text" size={14} color={colors.muted} />
                    <Text className="text-muted text-sm" style={{ flex: 1 }}>{group.description}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Debts Tab */}
        {activeTab === "debts" && (
          <View className="px-5">
            {debts.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: "#10B981" + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <IconSymbol name="checkmark.circle.fill" size={28} color="#10B981" />
                </View>
                <Text className="text-foreground font-bold text-base mb-1">Aucune dette</Text>
                <Text className="text-muted text-sm text-center">
                  {expenses.length === 0
                    ? "Aucune dépense enregistrée pour cette soirée."
                    : "Toutes les dépenses sont équilibrées."}
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-foreground font-bold mb-3">Remboursements à effectuer</Text>
                {debts.map((debt, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: "#EF4444" + "20",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontWeight: "700", color: "#EF4444", fontSize: 13 }}>
                              {debt.fromName.charAt(0)}
                            </Text>
                          </View>
                          <Text className="text-foreground font-semibold text-sm">{debt.fromName}</Text>
                        </View>
                      </View>

                      <View style={{ alignItems: "center", paddingHorizontal: 12 }}>
                        <IconSymbol name="arrow.right" size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15, marginTop: 2 }}>
                          {formatEuros(debt.amountCents)}
                        </Text>
                      </View>

                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text className="text-foreground font-semibold text-sm">{debt.toName}</Text>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: "#10B981" + "20",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontWeight: "700", color: "#10B981", fontSize: 13 }}>
                              {debt.toName.charAt(0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Total */}
                <View
                  style={{
                    backgroundColor: colors.primary + "10",
                    borderRadius: 14,
                    padding: 14,
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: colors.primary + "30",
                    alignItems: "center",
                  }}
                >
                  <Text className="text-muted text-xs">Total des remboursements</Text>
                  <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 20, marginTop: 2 }}>
                    {formatEuros(debts.reduce((sum, d) => sum + d.amountCents, 0))}
                  </Text>
                </View>
              </>
            )}

            {/* Expense breakdown */}
            {expenses.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text className="text-foreground font-bold mb-3">Détail des dépenses</Text>
                {expenses.map((expense) => {
                  const payer = group.members.find((m) => m.id === expense.paidBy);
                  return (
                    <View
                      key={expense.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text className="text-foreground font-semibold text-sm">{expense.description}</Text>
                        <Text className="text-muted text-xs">
                          Payé par {payer?.name || "Inconnu"} - Partagé entre {expense.splitBetween.length}
                        </Text>
                      </View>
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
                        {formatEuros(toCents(expense.amount))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Photos Tab */}
        {activeTab === "photos" && (
          <View className="px-5">
            {photos.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: "#EC4899" + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <IconSymbol name="photo.fill" size={28} color="#EC4899" />
                </View>
                <Text className="text-foreground font-bold text-base mb-1">Aucune photo</Text>
                <Text className="text-muted text-sm text-center">
                  Aucune photo n'a été ajoutée à cette soirée.
                </Text>
              </View>
            ) : (
              <>
                <Text className="text-foreground font-bold mb-3">
                  Galerie ({photos.length} photos)
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {photos.map((photo) => (
                    <View
                      key={photo.id}
                      style={{
                        width: "32%",
                        aspectRatio: 1,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri: photo.uri }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        transition={200}
                      />
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          padding: 4,
                        }}
                      >
                        <Text style={{ color: "#FFF", fontSize: 8, textAlign: "center" }}>
                          {photo.uploadedByName}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Share Button */}
        <View className="px-5 mt-6">
          <Pressable
            onPress={handleShare}
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
            <IconSymbol name="paperplane.fill" size={18} color="#FFF" />
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
              Partager le bilan
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

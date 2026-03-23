import { useState, useEffect, useMemo } from "react";
import { Text, View, Pressable, ScrollView, TextInput, Platform, Alert, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";
import { useRegisterOfflineHandler } from "@/hooks/use-offline-queue";
import { SwipeableRow } from "@/components/swipeable-row";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

type Mode = "list" | "tricount";

export default function ShoppingScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [mode, setMode] = useState<Mode>("list");
  const [newItem, setNewItem] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [newExpPaidBy, setNewExpPaidBy] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const group = state.groups.find((g) => g.id === groupId);
  const items = state.shoppingItems.filter((i) => i.groupId === groupId);
  const expenses = state.expenses.filter((e) => e.groupId === groupId);
  const userId = state.profile?.id || "user_1";

  // Backend group ID
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  // Backend queries — SSE handles real-time, polling is 30s fallback
  const shoppingQuery = trpc.shopping.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  const expensesQuery = trpc.expenses.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );

  // SSE: refetch immediately when someone changes shopping/expenses
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "shopping") shoppingQuery.refetch();
  });

  // externalId → backend numeric id maps
  const shoppingBackendIds = useMemo(
    () => new Map((shoppingQuery.data ?? []).map((i) => [i.externalId, i.id])),
    [shoppingQuery.data]
  );

  // Sync shopping from backend → local state
  useEffect(() => {
    if (!shoppingQuery.data || !groupId) return;
    const mapped = shoppingQuery.data.map((item) => ({
      id: item.externalId,
      groupId: groupId!,
      name: item.name,
      status: item.checked ? ("bought" as const) : ("to_buy" as const),
      price: parseFloat(item.price || "0") || 0,
      assignedTo: item.assignedTo || undefined,
      addedBy: String(item.addedBy),
      createdAt: item.createdAt.toString(),
    }));
    dispatch({ type: "SET_GROUP_SHOPPING_ITEMS", payload: { groupId: groupId!, items: mapped } });
  }, [shoppingQuery.data, groupId]);

  // Sync expenses from backend → local state
  useEffect(() => {
    if (!expensesQuery.data || !groupId) return;
    const mapped = expensesQuery.data.map((exp) => ({
      id: exp.externalId,
      groupId: groupId!,
      description: exp.description,
      amount: parseFloat(exp.amount) || 0,
      paidBy: exp.paidBy,
      splitBetween: (() => { try { return JSON.parse(exp.splitBetween || "[]"); } catch { return []; } })(),
      createdAt: exp.createdAt.toString(),
    }));
    dispatch({ type: "SET_GROUP_EXPENSES", payload: { groupId: groupId!, expenses: mapped } });
  }, [expensesQuery.data, groupId]);

  // Mutations
  const { isLoading: isActionLoading, buildOptions } = useMutationWithToast();
  const addShoppingMutation = trpc.shopping.add.useMutation(
    buildOptions({ offlineType: "shopping.add", onSuccess: () => shoppingQuery.refetch() })
  );

  useRegisterOfflineHandler("shopping.add", async (action) => {
    await addShoppingMutation.mutateAsync(action.payload);
    await shoppingQuery.refetch();
  });
  const updateShoppingMutation = trpc.shopping.update.useMutation(
    buildOptions({ onSuccess: () => shoppingQuery.refetch() })
  );
  const deleteShoppingMutation = trpc.shopping.delete.useMutation(
    buildOptions({ onSuccess: () => shoppingQuery.refetch() })
  );
  const addExpenseMutation = trpc.expenses.add.useMutation(
    buildOptions({ onSuccess: () => expensesQuery.refetch() })
  );

  // Tricount calculations
  const boughtItems = items.filter((i) => i.status === "bought");
  const totalItems = items.reduce((sum, i) => sum + i.price, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const memberBalances: Record<string, number> = {};
  if (group) {
    group.members.forEach((m) => { memberBalances[m.id] = 0; });
    expenses.forEach((exp) => {
      const share = exp.amount / exp.splitBetween.length;
      memberBalances[exp.paidBy] = (memberBalances[exp.paidBy] || 0) + exp.amount;
      exp.splitBetween.forEach((uid) => { memberBalances[uid] = (memberBalances[uid] || 0) - share; });
    });
  }

  const getMemberName = (id: string) => group?.members.find((m) => m.id === id)?.name || "Inconnu";
  const getMemberInitial = (id: string) => getMemberName(id).charAt(0);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    const externalId = generateId();
    dispatch({
      type: "ADD_SHOPPING_ITEM",
      payload: {
        id: externalId,
        groupId: groupId!,
        name: newItem.trim(),
        status: "to_buy",
        price: parseFloat(newPrice) || 0,
        addedBy: userId,
        createdAt: new Date().toISOString(),
      },
    });
    if (backendGroupId) {
      addShoppingMutation.mutate({
        externalId,
        groupId: backendGroupId,
        name: newItem.trim(),
        price: newPrice || undefined,
      });
    }
    setNewItem("");
    setNewPrice("");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([shoppingQuery.refetch(), expensesQuery.refetch()]); }
    finally { setRefreshing(false); }
  };

  const handleToggleItem = (itemId: string) => {
    hapticLight();
    const item = items.find((i) => i.id === itemId);
    const newStatus = item?.status === "bought" ? "to_buy" : "bought";
    const newAssignedTo = newStatus === "bought" ? userId : "";
    dispatch({
      type: "UPDATE_SHOPPING_ITEM",
      payload: { id: itemId, updates: { status: newStatus, assignedTo: newAssignedTo || undefined } },
    });
    const backendId = shoppingBackendIds.get(itemId);
    if (backendId) {
      updateShoppingMutation.mutate({ id: backendId, checked: newStatus === "bought", assignedTo: newAssignedTo });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    const doDelete = () => {
      hapticSuccess();
      dispatch({ type: "DELETE_SHOPPING_ITEM", payload: itemId });
      const backendId = shoppingBackendIds.get(itemId);
      if (backendId) deleteShoppingMutation.mutate({ id: backendId });
    };
    if (Platform.OS === "web") {
      if (confirm("Supprimer cet article ?")) doDelete();
    } else {
      Alert.alert("Supprimer l'article", "Cette action est irréversible.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleAddExpense = () => {
    if (!newExpDesc.trim() || !newExpAmount) return;
    const paidBy = newExpPaidBy || userId;
    const externalId = generateId();
    const splitBetweenMembers = group?.members.map((m) => m.id) || [];
    dispatch({
      type: "ADD_EXPENSE",
      payload: {
        id: externalId,
        groupId: groupId!,
        description: newExpDesc.trim(),
        amount: parseFloat(newExpAmount) || 0,
        paidBy,
        splitBetween: splitBetweenMembers,
        createdAt: new Date().toISOString(),
      },
    });
    if (backendGroupId) {
      addExpenseMutation.mutate({
        externalId,
        groupId: backendGroupId,
        description: newExpDesc.trim(),
        amount: newExpAmount,
        paidBy,
        paidByName: getMemberName(paidBy),
        splitBetween: JSON.stringify(splitBetweenMembers),
      });
    }
    setNewExpDesc("");
    setNewExpAmount("");
    setNewExpPaidBy("");
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-3">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-foreground text-xl font-bold" style={{ flex: 1 }}>Courses</Text>
      </View>

      {/* Mode Toggle */}
      <View className="px-5 mb-4">
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border }}>
          {[
            { key: "list" as Mode, label: "Liste", icon: "cart.fill" as const },
            { key: "tricount" as Mode, label: "Tricount", icon: "dollarsign.circle.fill" as const },
          ].map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={({ pressed }) => [
                { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: mode === m.key ? colors.primary : "transparent" },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol name={m.icon} size={14} color={mode === m.key ? "#FFF" : colors.muted} />
              <Text style={{ color: mode === m.key ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 12 }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        {mode === "list" ? (
          <>
            {/* Summary */}
            <View className="px-5 mb-4">
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                  <Text className="text-foreground text-xl font-bold">{items.length}</Text>
                  <Text className="text-muted text-xs">Articles</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                  <Text className="text-foreground text-xl font-bold">{boughtItems.length}</Text>
                  <Text className="text-muted text-xs">Achetés</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.primary + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.primary + "30", alignItems: "center" }}>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>{totalItems.toFixed(0)}€</Text>
                  <Text className="text-muted text-xs">Total</Text>
                </View>
              </View>
            </View>

            {/* Add Item */}
            <View className="px-5 mb-4">
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  placeholder="Ajouter un article..."
                  placeholderTextColor={colors.muted}
                  value={newItem}
                  onChangeText={setNewItem}
                  returnKeyType="done"
                  onSubmitEditing={handleAddItem}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                />
                <TextInput
                  placeholder="Prix"
                  placeholderTextColor={colors.muted}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  keyboardType="numeric"
                  style={{ width: 70, backgroundColor: colors.surface, borderRadius: 12, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, textAlign: "center" }}
                />
                <Pressable
                  onPress={handleAddItem}
                  disabled={isActionLoading}
                  style={({ pressed }) => [
                    { backgroundColor: colors.primary, borderRadius: 12, width: 44, alignItems: "center", justifyContent: "center" },
                    (pressed || isActionLoading) && { opacity: 0.7 },
                  ]}
                >
                  <IconSymbol name="plus" size={20} color="#FFF" />
                </Pressable>
              </View>
            </View>

            {/* Items List — split into unassigned then assigned sections */}
            <View className="px-5">
              {items.length === 0 ? (
                <View className="items-center py-12">
                  <IconSymbol name="cart.fill" size={48} color={colors.muted} />
                  <Text className="text-muted mt-3 text-center">Aucun article pour le moment</Text>
                </View>
              ) : (
                [...items]
                  .sort((a, b) => {
                    if (a.status === b.status) return 0;
                    return a.status === "bought" ? 1 : -1;
                  })
                  .map((item) => {
                    const isBought = item.status === "bought";
                    return (
                      <SwipeableRow key={item.id} onDelete={() => handleDeleteItem(item.id)}>
                        <View
                          style={{
                            backgroundColor: colors.surface,
                            borderRadius: 14,
                            padding: 12,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: isBought ? colors.success + "40" : colors.border,
                            opacity: isBought ? 0.7 : 1,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Pressable onPress={() => handleToggleItem(item.id)} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isBought ? colors.success : colors.border, backgroundColor: isBought ? colors.success : "transparent", alignItems: "center", justifyContent: "center" }}>
                                {isBought && <IconSymbol name="checkmark" size={14} color="#FFF" />}
                              </View>
                            </Pressable>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, textDecorationLine: isBought ? "line-through" : "none" }}>
                                {item.name}
                              </Text>
                              {isBought && item.assignedTo ? (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success + "25", alignItems: "center", justifyContent: "center" }}>
                                    <Text style={{ color: colors.success, fontSize: 9, fontWeight: "700" }}>{getMemberInitial(item.assignedTo)}</Text>
                                  </View>
                                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: "500" }}>
                                    Acheté par {item.assignedTo === userId ? "vous" : getMemberName(item.assignedTo)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            {item.price > 0 && (
                              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>{item.price}€</Text>
                            )}
                            <Pressable onPress={() => handleDeleteItem(item.id)} style={({ pressed }) => [pressed && { opacity: 0.5 }]}>
                              <IconSymbol name="xmark" size={14} color={colors.muted} />
                            </Pressable>
                          </View>
                        </View>
                      </SwipeableRow>
                    );
                  })
              )}
            </View>

            {/* Récapitulatif par personne */}
            {items.some((i) => !!i.assignedTo) && group && (
              <View className="px-5 mt-4">
                <Text className="text-foreground font-bold mb-3">Récapitulatif</Text>
                {group.members.map((m) => {
                  const myItems = items.filter((i) => i.assignedTo === m.id);
                  if (myItems.length === 0) return null;
                  const myTotal = myItems.reduce((sum, i) => sum + i.price, 0);
                  return (
                    <View key={m.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "25", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                          <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 13 }}>{m.name.charAt(0)}</Text>
                        </View>
                        <Text style={{ flex: 1, color: colors.foreground, fontWeight: "700", fontSize: 14 }}>{m.id === userId ? "Vous" : m.name}</Text>
                        {myTotal > 0 && (
                          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 15 }}>{myTotal.toFixed(2)}€</Text>
                        )}
                      </View>
                      {myItems.map((item) => (
                        <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingLeft: 42 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.status === "bought" ? colors.success : colors.muted, marginRight: 8 }} />
                          <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, textDecorationLine: item.status === "bought" ? "line-through" : "none" }}>{item.name}</Text>
                          {item.price > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{item.price}€</Text>}
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Tricount Summary */}
            <View className="px-5 mb-4">
              <View style={{ backgroundColor: colors.primary + "15", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary + "30", alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800" }}>{totalExpenses.toFixed(2)}€</Text>
                <Text className="text-muted text-sm mt-1">Total des dépenses</Text>
              </View>
            </View>

            {/* Add Expense */}
            <View className="px-5 mb-4">
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <TextInput
                  placeholder="Description de la dépense"
                  placeholderTextColor={colors.muted}
                  value={newExpDesc}
                  onChangeText={setNewExpDesc}
                  style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
                />
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <TextInput
                    placeholder="Montant (€)"
                    placeholderTextColor={colors.muted}
                    value={newExpAmount}
                    onChangeText={setNewExpAmount}
                    keyboardType="numeric"
                    style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                  />
                </View>
                <Text className="text-muted text-xs mb-2">Payé par : {getMemberName(newExpPaidBy || userId)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {group?.members.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => setNewExpPaidBy(m.id)}
                        style={({ pressed }) => [
                          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: (newExpPaidBy || userId) === m.id ? colors.primary : colors.background, borderWidth: 1, borderColor: (newExpPaidBy || userId) === m.id ? colors.primary : colors.border },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={{ color: (newExpPaidBy || userId) === m.id ? "#FFF" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                          {m.name.split(" ")[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <Pressable
                  onPress={handleAddExpense}
                  style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: "#FFF", fontWeight: "600" }}>Ajouter la dépense</Text>
                </Pressable>
              </View>
            </View>

            {/* Balances */}
            <View className="px-5 mb-4">
              <Text className="text-foreground font-bold mb-3">Bilan</Text>
              {group?.members.map((m) => {
                const balance = memberBalances[m.id] || 0;
                return (
                  <View key={m.id} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + "25", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                      <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 13 }}>{m.name.charAt(0)}</Text>
                    </View>
                    <Text className="text-foreground text-sm font-semibold" style={{ flex: 1 }}>{m.name}</Text>
                    <Text style={{ fontWeight: "700", fontSize: 14, color: balance >= 0 ? colors.success : colors.error }}>
                      {balance >= 0 ? "+" : ""}{balance.toFixed(2)}€
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Expenses List */}
            <View className="px-5">
              <Text className="text-foreground font-bold mb-3">Historique</Text>
              {expenses.length === 0 ? (
                <View className="items-center py-8">
                  <Text className="text-muted text-center">Aucune dépense pour le moment</Text>
                </View>
              ) : (
                expenses.map((exp) => (
                  <View key={exp.id} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text className="text-foreground font-semibold text-sm">{exp.description}</Text>
                      <Text className="text-muted text-xs mt-1">Payé par {getMemberName(exp.paidBy)}</Text>
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>{exp.amount.toFixed(2)}€</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

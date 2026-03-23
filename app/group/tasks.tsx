import { useState, useMemo, useEffect } from "react";
import { Text, View, Pressable, ScrollView, TextInput, Alert, Platform, RefreshControl } from "react-native";
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

const PRIORITY_CONFIG = {
  low: { label: "Basse", color: "#10B981" },
  medium: { label: "Moyenne", color: "#F59E0B" },
  high: { label: "Haute", color: "#EF4444" },
};

export default function TasksScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const group = state.groups.find((g) => g.id === groupId);
  const tasks = state.tasks.filter((t) => t.groupId === groupId);
  const completedCount = tasks.filter((t) => t.completed).length;
  const userId = state.profile?.id || "user_1";

  // Get backend group ID
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  // Poll backend tasks
  const tasksQuery = trpc.tasks.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );

  // SSE: refetch immediately when server broadcasts a "tasks" refresh event
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "tasks") tasksQuery.refetch();
  });

  // externalId → backendId map
  const tasksBackendIds = useMemo(
    () => new Map((tasksQuery.data ?? []).map((t) => [t.externalId, t.id])),
    [tasksQuery.data]
  );

  // Sync backend → local state
  useEffect(() => {
    if (!tasksQuery.data || !groupId) return;
    const mapped = tasksQuery.data.map((t) => ({
      id: t.externalId,
      groupId: groupId!,
      title: t.title,
      assignedTo: t.assignedTo ?? undefined,
      assignedToName: (t as any).assignedToName ?? undefined,
      priority: (t.priority ?? "medium") as "low" | "medium" | "high",
      completed: t.completed,
      createdAt: t.createdAt.toString(),
    }));
    dispatch({ type: "SET_GROUP_TASKS", payload: { groupId: groupId!, tasks: mapped } });
  }, [tasksQuery.data, groupId]);

  // Mutations
  const { isLoading: isActionLoading, buildOptions } = useMutationWithToast();
  const addTaskMutation = trpc.tasks.add.useMutation(
    buildOptions({ offlineType: "tasks.add" })
  );

  useRegisterOfflineHandler("tasks.add", async (action) => {
    await addTaskMutation.mutateAsync(action.payload);
    await tasksQuery.refetch();
  });
  const updateTaskMutation = trpc.tasks.update.useMutation(buildOptions());
  const deleteTaskMutation = trpc.tasks.delete.useMutation(buildOptions());
  const claimTaskMutation = trpc.tasks.claim.useMutation(
    buildOptions({
      onSuccess: () => tasksQuery.refetch(),
      onError: (err) => {
        if (err?.data?.code === "CONFLICT") {
          if (Platform.OS === "web") alert("Cette tâche vient d'être prise par quelqu'un d'autre !");
          else Alert.alert("Tâche déjà prise", "Cette tâche vient d'être prise par quelqu'un d'autre !");
          return false; // supprime le toast générique pour CONFLICT
        }
      },
    })
  );

  const handleAdd = () => {
    if (!title.trim()) return;
    const member = group?.members.find((m) => m.id === assignedTo);
    const externalId = generateId();
    dispatch({
      type: "ADD_TASK",
      payload: {
        id: externalId,
        groupId: groupId!,
        title: title.trim(),
        assignedTo: assignedTo || undefined,
        assignedToName: member?.name,
        priority,
        completed: false,
        createdAt: new Date().toISOString(),
      },
    });
    if (backendGroupId) {
      addTaskMutation.mutate({
        externalId,
        groupId: backendGroupId,
        title: title.trim(),
        assignedTo: assignedTo || undefined,
        assignedToName: member?.name,
        priority,
      });
    }
    setTitle("");
    setPriority("medium");
    setAssignedTo("");
    setShowAdd(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await tasksQuery.refetch(); } finally { setRefreshing(false); }
  };

  const handleToggle = (taskId: string, completed: boolean) => {
    hapticLight();
    dispatch({ type: "UPDATE_TASK", payload: { id: taskId, updates: { completed: !completed } } });
    const backendId = tasksBackendIds.get(taskId);
    if (backendId) {
      updateTaskMutation.mutate({ id: backendId, completed: !completed });
    }
  };

  const handleDelete = (taskId: string) => {
    const doDelete = () => {
      hapticSuccess();
      dispatch({ type: "DELETE_TASK", payload: taskId });
      const backendId = tasksBackendIds.get(taskId);
      if (backendId) deleteTaskMutation.mutate({ id: backendId });
    };
    if (Platform.OS === "web") {
      if (confirm("Supprimer cette tâche ?")) doDelete();
    } else {
      Alert.alert("Supprimer la tâche", "Cette action est irréversible.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleClaim = (taskId: string) => {
    const backendId = tasksBackendIds.get(taskId);
    if (!backendId) return;
    claimTaskMutation.mutate({ id: backendId });
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Tâches</Text>
        </View>
        <Pressable
          onPress={() => setShowAdd(!showAdd)}
          style={({ pressed }) => [
            { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Ajouter</Text>
        </Pressable>
      </View>

      {/* Progress */}
      <View className="px-5 mb-4">
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text className="text-foreground font-semibold text-sm">Progression</Text>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
              {completedCount}/{tasks.length}
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                width: tasks.length > 0 ? `${(completedCount / tasks.length) * 100}%` : "0%",
                backgroundColor: colors.primary,
                borderRadius: 4,
              }}
            />
          </View>
        </View>
      </View>

      {/* Add Task Form */}
      {showAdd && (
        <View className="px-5 mb-4">
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.primary }}>
            <TextInput
              placeholder="Titre de la tâche..."
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}
            />
            <Text className="text-foreground text-xs font-semibold mb-2">Priorité</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {(["low", "medium", "high"] as const).map((p) => {
                const config = PRIORITY_CONFIG[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: "center",
                        backgroundColor: priority === p ? config.color + "20" : colors.background,
                        borderWidth: 1,
                        borderColor: priority === p ? config.color : colors.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: priority === p ? config.color : colors.muted, fontWeight: "600", fontSize: 12 }}>
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-foreground text-xs font-semibold mb-2">Assigner à</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => setAssignedTo("")}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: !assignedTo ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: !assignedTo ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: !assignedTo ? "#FFF" : colors.foreground, fontSize: 12, fontWeight: "600" }}>Personne</Text>
                </Pressable>
                {group?.members.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setAssignedTo(m.id)}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: assignedTo === m.id ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: assignedTo === m.id ? colors.primary : colors.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: assignedTo === m.id ? "#FFF" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                      {m.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable
              onPress={handleAdd}
              disabled={isActionLoading}
              style={({ pressed }) => [
                { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
                (pressed || isActionLoading) && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Créer la tâche</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tasks List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        {tasks.length === 0 ? (
          <View className="items-center py-12">
            <IconSymbol name="checkmark.circle.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-3">Aucune tâche pour le moment</Text>
          </View>
        ) : (
          tasks.map((task) => {
            const prioConfig = PRIORITY_CONFIG[task.priority];
            return (
              <SwipeableRow key={task.id} onDelete={() => handleDelete(task.id)}>
                <Pressable
                  onPress={() => handleToggle(task.id, task.completed)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 6,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderLeftWidth: 3,
                      borderLeftColor: prioConfig.color,
                      opacity: task.completed ? 0.6 : 1,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: task.completed ? colors.success : colors.border,
                      backgroundColor: task.completed ? colors.success : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    {task.completed && <IconSymbol name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "600",
                        fontSize: 14,
                        textDecorationLine: task.completed ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {task.assignedToName ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <View style={{
                            width: 16, height: 16, borderRadius: 8,
                            backgroundColor: colors.primary + "25",
                            alignItems: "center", justifyContent: "center",
                          }}>
                            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 9 }}>
                              {task.assignedToName.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{task.assignedToName}</Text>
                        </View>
                      ) : (
                        !task.completed && (
                          <Pressable
                            onPress={() => handleClaim(task.id)}
                            style={({ pressed }) => [
                              {
                                flexDirection: "row", alignItems: "center", gap: 4,
                                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                                backgroundColor: colors.primary + "15",
                                borderWidth: 1, borderColor: colors.primary + "40",
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <IconSymbol name="hand.raised.fill" size={10} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600" }}>Je prends</Text>
                          </Pressable>
                        )
                      )}
                      <View style={{ backgroundColor: prioConfig.color + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: prioConfig.color, fontSize: 10, fontWeight: "600" }}>{prioConfig.label}</Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(task.id)}
                    style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.5 }]}
                  >
                    <IconSymbol name="trash.fill" size={14} color={colors.muted} />
                  </Pressable>
                </Pressable>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

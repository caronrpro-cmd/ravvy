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

export default function PollsScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const polls = state.polls.filter((p) => p.groupId === groupId);
  const group = state.groups.find((g) => g.id === groupId);
  const userId = state.profile?.id || "user_1";
  const isAdmin = group?.createdBy === userId;

  // Get backend group ID
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  // Poll backend polls
  const pollsQuery = trpc.polls.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );

  // externalId → backendId map
  const pollsBackendIds = useMemo(
    () => new Map((pollsQuery.data ?? []).map((p) => [p.externalId, p.id])),
    [pollsQuery.data]
  );

  // Sync backend → local state
  useEffect(() => {
    if (!pollsQuery.data || !groupId) return;
    const mapped = pollsQuery.data.map((p) => ({
      id: p.externalId,
      groupId: groupId!,
      question: p.question,
      options: p.options ? JSON.parse(p.options) : [],
      createdBy: String(p.createdBy),
      createdAt: p.createdAt.toString(),
    }));
    dispatch({ type: "SET_GROUP_POLLS", payload: { groupId: groupId!, polls: mapped } });
  }, [pollsQuery.data, groupId]);

  // SSE: refetch immediately when server broadcasts a "polls" refresh event
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "polls") pollsQuery.refetch();
  });

  // Mutations
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await pollsQuery.refetch(); } finally { setRefreshing(false); }
  };

  const { isLoading: isActionLoading, buildOptions } = useMutationWithToast();
  const addPollMutation = trpc.polls.add.useMutation(
    buildOptions({ onSuccess: () => pollsQuery.refetch() })
  );
  const deletePollMutation = trpc.polls.delete.useMutation(
    buildOptions({ onSuccess: () => pollsQuery.refetch() })
  );
  const voteMutation = trpc.polls.vote.useMutation(
    buildOptions({ offlineType: "polls.vote", onSuccess: () => pollsQuery.refetch() })
  );

  useRegisterOfflineHandler("polls.vote", async (action) => {
    await voteMutation.mutateAsync(action.payload);
    await pollsQuery.refetch();
  });
  const clearVotesMutation = trpc.polls.clearVotes.useMutation(
    buildOptions({ onSuccess: () => pollsQuery.refetch() })
  );

  const handleCreate = () => {
    if (!question.trim() || options.filter((o) => o.trim()).length < 2) return;
    const externalId = generateId();
    const pollOptions = options
      .filter((o) => o.trim())
      .map((o) => ({ id: generateId(), text: o.trim(), votes: [] }));

    dispatch({
      type: "ADD_POLL",
      payload: {
        id: externalId,
        groupId: groupId!,
        question: question.trim(),
        options: pollOptions,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
    });

    if (backendGroupId) {
      addPollMutation.mutate({
        externalId,
        groupId: backendGroupId,
        question: question.trim(),
        options: JSON.stringify(pollOptions),
      });
    }

    setQuestion("");
    setOptions(["", ""]);
    setShowCreate(false);
  };

  const handleDeletePoll = (pollId: string) => {
    const doDelete = () => {
      dispatch({ type: "DELETE_POLL", payload: pollId });
      const backendId = pollsBackendIds.get(pollId);
      if (backendId) {
        deletePollMutation.mutate({ id: backendId });
      }
    };
    if (Platform.OS === "web") {
      if (confirm("Supprimer ce sondage ?")) doDelete();
    } else {
      Alert.alert("Supprimer le sondage", "Cette action est irréversible.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleVote = (pollId: string, optionId: string) => {
    dispatch({ type: "VOTE_POLL", payload: { pollId, optionId, userId } });
    const backendId = pollsBackendIds.get(pollId);
    if (backendId) {
      voteMutation.mutate({ pollId: backendId, optionId });
    }
  };

  const handleClearMyVotes = (pollId: string) => {
    dispatch({ type: "UNVOTE_POLL", payload: { pollId, userId } });
    const backendId = pollsBackendIds.get(pollId);
    if (backendId) {
      clearVotesMutation.mutate({ pollId: backendId });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            </Pressable>
            <Text className="text-foreground text-xl font-bold">Sondages</Text>
          </View>
          <Pressable
            onPress={() => setShowCreate(!showCreate)}
            style={({ pressed }) => [
              { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Nouveau</Text>
          </Pressable>
        </View>

        {showCreate && (
          <View className="px-5 mb-4">
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.primary }}>
              <TextInput
                placeholder="Votre question..."
                placeholderTextColor={colors.muted}
                value={question}
                onChangeText={setQuestion}
                style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}
              />
              {options.map((opt, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                  <TextInput
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={colors.muted}
                    value={opt}
                    onChangeText={(text) => {
                      const newOpts = [...options];
                      newOpts[i] = text;
                      setOptions(newOpts);
                    }}
                    style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                  />
                  {options.length > 2 && (
                    <Pressable
                      onPress={() => setOptions(options.filter((_, idx) => idx !== i))}
                      style={({ pressed }) => [
                        { width: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.error + "10" },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <IconSymbol name="xmark" size={14} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => setOptions([...options, ""])}
                  style={({ pressed }) => [{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.background, alignItems: "center", borderWidth: 1, borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>+ Option</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  disabled={isActionLoading}
                  style={({ pressed }) => [
                    { flex: 1, padding: 10, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center" },
                    (pressed || isActionLoading) && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Créer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View className="px-5">
          {polls.length === 0 ? (
            <View className="items-center py-12">
              <Text style={{ fontSize: 40, marginBottom: 8 }}>📊</Text>
              <Text className="text-muted text-center">Aucun sondage pour le moment</Text>
            </View>
          ) : (
            polls.map((poll) => {
              const uniqueVoters = new Set(poll.options.flatMap((o) => o.votes)).size;
              const myVotedOptions = new Set(poll.options.filter((o) => o.votes.includes(userId)).map((o) => o.id));
              const isPollCreator = poll.createdBy === userId;
              return (
                <View key={poll.id} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                  {/* Poll header */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4 }}>
                    <Text className="text-foreground font-bold text-sm" style={{ flex: 1 }}>{poll.question}</Text>
                    {(isAdmin || isPollCreator) && (
                      <Pressable
                        onPress={() => handleDeletePoll(poll.id)}
                        style={({ pressed }) => [
                          {
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            backgroundColor: colors.error + "10",
                            alignItems: "center",
                            justifyContent: "center",
                            marginLeft: 8,
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <IconSymbol name="trash.fill" size={12} color={colors.error} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 10 }}>
                    Plusieurs réponses possibles
                  </Text>

                  {/* Options */}
                  {poll.options.map((opt) => {
                    const pct = uniqueVoters > 0 ? (opt.votes.length / uniqueVoters) * 100 : 0;
                    const voted = myVotedOptions.has(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => handleVote(poll.id, opt.id)}
                        style={({ pressed }) => [
                          {
                            marginBottom: 6,
                            borderRadius: 10,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: voted ? colors.primary : colors.border,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: voted ? colors.primary + "20" : colors.border + "30" }} />
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <View style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              borderWidth: 2,
                              borderColor: voted ? colors.primary : colors.muted,
                              backgroundColor: voted ? colors.primary : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                            }}>
                              {voted && <IconSymbol name="checkmark" size={11} color="#FFF" />}
                            </View>
                            <Text style={{ color: voted ? colors.primary : colors.foreground, fontWeight: voted ? "700" : "500", fontSize: 13, flex: 1 }}>
                              {opt.text}
                            </Text>
                          </View>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{opt.votes.length} ({Math.round(pct)}%)</Text>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Footer */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {uniqueVoters} participant{uniqueVoters !== 1 ? "s" : ""}
                      {myVotedOptions.size > 0 ? ` · ${myVotedOptions.size} sélection${myVotedOptions.size > 1 ? "s" : ""}` : ""}
                    </Text>
                    {myVotedOptions.size > 0 && (
                      <Pressable
                        onPress={() => handleClearMyVotes(poll.id)}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 8,
                            backgroundColor: colors.error + "10",
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <IconSymbol name="xmark" size={10} color={colors.error} />
                        <Text style={{ color: colors.error, fontSize: 11, fontWeight: "600" }}>Tout décocher</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

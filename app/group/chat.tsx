import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Text, View, Pressable, TextInput, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image, RefreshControl, ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { useChatSSE } from "@/hooks/use-chat-sse";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";
import { useRegisterOfflineHandler } from "@/hooks/use-offline-queue";
import { getAvatarColor } from "@/lib/avatar-color";
import { hapticLight, hapticMedium, hapticSuccess } from "@/lib/haptics";
import { getApiBaseUrl } from "@/constants/oauth";
import type { ChatMessage } from "@/lib/types";

let ImagePicker: typeof import("expo-image-picker") | null = null;
if (Platform.OS !== "web") {
  try { ImagePicker = require("expo-image-picker"); } catch {}
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export default function ChatScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const group = state.groups.find((g) => g.id === groupId);
  const myId = state.profile?.id || "user_1";

  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;
  const utils = trpc.useUtils();

  const messagesInfiniteQuery = trpc.chat.messages.useInfiniteQuery(
    { groupId: backendGroupId ?? 0, limit: 50 },
    {
      enabled: !!backendGroupId,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 0,
      refetchInterval: 2000,
    }
  );

  useChatSSE(groupId, backendGroupId);
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "chat") messagesInfiniteQuery.refetch();
  });

  const pagesMessages = useMemo(() => {
    if (!messagesInfiniteQuery.data || !groupId) return [];
    return [...messagesInfiniteQuery.data.pages].reverse().flatMap((page) =>
      page.messages.map((msg) => ({
        id: msg.externalId,
        groupId: groupId!,
        senderId: String(msg.senderId),
        senderName: (msg as any).senderName || "Inconnu",
        senderAvatar: (msg as any).senderAvatar || "",
        text: msg.text || "",
        type: msg.type as "text" | "image" | "location",
        imageUrl: (msg as any).imageUrl,
        reactions: (msg as any).reactions || [],
        isPinned: msg.isPinned,
        createdAt: msg.createdAt.toString(),
        replyTo: (msg as any).replyTo,
      }))
    );
  }, [messagesInfiniteQuery.data, groupId]);

  const pagesMessageIds = useMemo(() => new Set(pagesMessages.map((m) => m.id)), [pagesMessages]);
  const sseMessages = useMemo(
    () => state.chatMessages.filter((m) => m.groupId === groupId && !pagesMessageIds.has(m.id)),
    [state.chatMessages, groupId, pagesMessageIds]
  );

  const [allMessages, setAllMessages] = useState<ChatMessage[]>(() =>
    [...pagesMessages, ...sseMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ) as ChatMessage[]
  );
  useEffect(() => {
    setAllMessages(
      [...pagesMessages, ...sseMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ) as ChatMessage[]
    );
  }, [pagesMessages, sseMessages]);

  const firstPage = messagesInfiniteQuery.data?.pages[0];
  useEffect(() => {
    if (!firstPage || !groupId) return;
    const mapped = firstPage.messages.map((msg) => ({
      id: msg.externalId,
      groupId: groupId!,
      senderId: String(msg.senderId),
      senderName: (msg as any).senderName || "Inconnu",
      senderAvatar: (msg as any).senderAvatar || "",
      text: msg.text || "",
      type: msg.type as "text" | "image" | "location",
      imageUrl: (msg as any).imageUrl,
      reactions: (msg as any).reactions || [],
      isPinned: msg.isPinned,
      createdAt: msg.createdAt.toString(),
      replyTo: (msg as any).replyTo,
    }));
    dispatch({ type: "SET_GROUP_CHAT_MESSAGES", payload: { groupId: groupId!, messages: mapped } });
  }, [firstPage, groupId]);

  const markAsReadMutation = trpc.chat.markAsRead.useMutation({
    onSuccess: (_data, variables) => {
      utils.chat.unreadCount.invalidate({ groupId: variables.groupId });
    },
  });

  // Mark chat as read when screen is focused (clears the unread badge)
  useFocusEffect(
    useCallback(() => {
      if (backendGroupId) {
        markAsReadMutation.mutate({ groupId: backendGroupId });
      }
      // Also clear local chat notifications for this group
      state.notifications
        .filter((n) => n.type === "chat" && n.groupId === groupId && !n.read)
        .forEach((n) => dispatch({ type: "MARK_NOTIFICATION_READ", payload: n.id }));
    }, [backendGroupId, groupId])
  );

  const { buildOptions } = useMutationWithToast();
  const sendMessageMutation = trpc.chat.send.useMutation(
    buildOptions({ offlineType: "chat.send" })
  );

  useRegisterOfflineHandler("chat.send", async (action) => {
    await sendMessageMutation.mutateAsync(action.payload);
  });

  const hasScrolledToBottom = useRef(false);
  useEffect(() => {
    if (allMessages.length > 0 && !hasScrolledToBottom.current && !messagesInfiniteQuery.isFetchingNextPage) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      hasScrolledToBottom.current = true;
    }
  }, [allMessages.length, messagesInfiniteQuery.isFetchingNextPage]);

  const prevSseCount = useRef(0);
  useEffect(() => {
    if (sseMessages.length > prevSseCount.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
    prevSseCount.current = sseMessages.length;
  }, [sseMessages.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await messagesInfiniteQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;
    hapticSuccess();
    const text = message.trim();
    const externalId = generateId();
    const replyPayload = replyingTo
      ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text }
      : undefined;
    setMessage("");
    setReplyingTo(null);

    const newMsg: ChatMessage = {
      id: externalId,
      groupId: groupId!,
      senderId: myId,
      senderName: state.profile?.name || "Moi",
      senderAvatar: "",
      text,
      type: "text",
      reactions: [],
      isPinned: false,
      createdAt: new Date().toISOString(),
      replyTo: replyPayload,
    };
    dispatch({ type: "ADD_MESSAGE", payload: newMsg });

    if (backendGroupId) {
      sendMessageMutation.mutate({ externalId, groupId: backendGroupId, text, type: "text" });
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handlePickImage = async () => {
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
    });
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];

    const externalId = generateId();
    // Optimistic local
    const newMsg: ChatMessage = {
      id: externalId,
      groupId: groupId!,
      senderId: myId,
      senderName: state.profile?.name || "Moi",
      senderAvatar: "",
      text: "",
      type: "image",
      imageUrl: asset.uri,
      reactions: [],
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: newMsg });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (backendGroupId) {
      try {
        const formData = new FormData();
        formData.append("file", { uri: asset.uri, type: "image/jpeg", name: "chat.jpg" } as any);
        const uploadRes = await fetch(`${getApiBaseUrl()}/api/upload/photo`, {
          method: "POST",
          body: formData,
        });
        const uploadJson = await uploadRes.json();
        const imageUrl: string = uploadJson.url;
        sendMessageMutation.mutate({ externalId, groupId: backendGroupId, text: "", type: "image", imageUrl });
      } catch {}
    }
  };

  const handleLongPress = (msg: ChatMessage) => {
    hapticMedium();
    const isFriend = state.friends?.some((f) => f.id === msg.senderId);
    const isMe = msg.senderId === myId;

    const actions: any[] = [
      {
        text: "Répondre",
        onPress: () => { hapticLight(); setReplyingTo(msg); },
      },
    ];

    if (!isMe && !isFriend) {
      actions.push({
        text: "Ajouter en ami",
        onPress: () =>
          dispatch({
            type: "ADD_FRIEND",
            payload: {
              id: msg.senderId,
              name: msg.senderName,
              username: msg.senderName.toLowerCase().replace(/\s+/g, "_"),
              avatar: msg.senderAvatar || "",
              status: "available",
              addedAt: new Date().toISOString(),
            },
          }),
      });
    }

    actions.push({ text: "Annuler", style: "cancel" });

    if (Platform.OS === "web") {
      setReplyingTo(msg);
    } else {
      Alert.alert(msg.senderName, "Que voulez-vous faire ?", actions);
    }
  };

  const handleReact = (msgId: string, emoji: string) => {
    hapticLight();
    dispatch({ type: "REACT_MESSAGE" as any, payload: { messageId: msgId, emoji, userId: myId } });
  };

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y < 80 && messagesInfiniteQuery.hasNextPage && !messagesInfiniteQuery.isFetchingNextPage) {
      messagesInfiniteQuery.fetchNextPage();
    }
  };

  const formatMsgTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text className="text-foreground font-bold text-base" numberOfLines={1}>
              {group?.name || "Chat"}
            </Text>
            <Text className="text-muted text-xs">{group?.members.length || 0} participants</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          extraData={allMessages.length}
          onScroll={handleScroll}
          scrollEventThrottle={200}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={Platform.OS === "ios" ? { minIndexForVisible: 0 } : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />
          }
          ListHeaderComponent={
            messagesInfiniteQuery.isFetchingNextPage ? (
              <ActivityIndicator size="small" color={colors.muted} style={{ paddingVertical: 10 }} />
            ) : messagesInfiniteQuery.hasNextPage ? (
              <View style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>↑ Faire défiler pour charger plus</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            messagesInfiniteQuery.isLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <ActivityIndicator size="large" color={colors.muted} />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <IconSymbol name="bubble.left.fill" size={48} color={colors.muted} />
                <Text className="text-muted mt-3 text-center">
                  Aucun message.{"\n"}Commencez la conversation !
                </Text>
              </View>
            )
          }
          renderItem={({ item: msg, index }) => {
            const isMe = msg.senderId === myId;
            const showAvatar = !isMe && (index === 0 || allMessages[index - 1]?.senderId !== msg.senderId);
            const avatarColor = getAvatarColor(msg.senderName);

            return (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  marginBottom: 4,
                  marginTop: showAvatar ? 8 : 0,
                }}
              >
                {!isMe && (
                  <View style={{ width: 30, marginRight: 6 }}>
                    {showAvatar && (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: avatarColor + "30",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: avatarColor, fontSize: 11 }}>
                          {msg.senderName.charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <Pressable style={{ maxWidth: "75%" }} onLongPress={() => handleLongPress(msg)} delayLongPress={400}>
                  {showAvatar && !isMe && (
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 2, marginLeft: 4 }}>
                      {msg.senderName}
                    </Text>
                  )}
                  {/* Reply quote */}
                  {msg.replyTo && (
                    <View
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: isMe ? "#FFFFFF80" : colors.primary,
                        paddingLeft: 8,
                        marginBottom: 4,
                        marginHorizontal: 4,
                      }}
                    >
                      <Text style={{ color: isMe ? "#FFFFFF99" : colors.primary, fontSize: 10, fontWeight: "700" }}>
                        {msg.replyTo.senderName}
                      </Text>
                      <Text
                        style={{ color: isMe ? "#FFFFFFCC" : colors.muted, fontSize: 11 }}
                        numberOfLines={1}
                      >
                        {msg.replyTo.text}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      backgroundColor: isMe ? colors.primary : colors.surface,
                      borderRadius: 16,
                      borderTopLeftRadius: isMe ? 16 : 4,
                      borderTopRightRadius: isMe ? 4 : 16,
                      paddingHorizontal: msg.type === "image" ? 4 : 14,
                      paddingVertical: msg.type === "image" ? 4 : 10,
                    }}
                  >
                    {msg.type === "image" && msg.imageUrl ? (
                      <Image
                        source={{ uri: msg.imageUrl }}
                        style={{ width: 200, height: 150, borderRadius: 12 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={{ color: isMe ? "#FFF" : colors.foreground, fontSize: 14, lineHeight: 20 }}>
                        {msg.text}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: isMe ? "#FFFFFF80" : colors.muted,
                        fontSize: 10,
                        textAlign: "right",
                        marginTop: 4,
                      }}
                    >
                      {formatMsgTime(msg.createdAt)}
                    </Text>
                  </View>
                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, paddingHorizontal: 4 }}>
                      {Object.entries(
                        msg.reactions.reduce((acc: Record<string, number>, r: any) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <Pressable
                          key={emoji}
                          onPress={() => handleReact(msg.id, emoji)}
                          style={({ pressed }) => [
                            {
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 2,
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={{ fontSize: 12 }}>{emoji}</Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }}>{count as number}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {/* Quick reaction row (shown on long press via state — always visible for simplicity) */}
                </Pressable>
              </View>
            );
          }}
        />

        {/* Reply banner */}
        {replyingTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: colors.surface,
              borderTopWidth: 0.5,
              borderTopColor: colors.border,
              gap: 8,
            }}
          >
            <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                Répondre à {replyingTo.senderName}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                {replyingTo.text || (replyingTo.type === "image" ? "📷 Photo" : "")}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {/* Quick reactions bar */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 12,
            paddingVertical: 4,
            gap: 6,
          }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => {
                if (allMessages.length > 0) {
                  const last = allMessages[allMessages.length - 1];
                  if (last) handleReact(last.id, emoji);
                }
              }}
              style={({ pressed }) => [
                {
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.9 }] },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {/* Input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 12,
            paddingVertical: 8,
            paddingBottom: Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8),
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            gap: 8,
          }}
        >
          {/* Image picker button */}
          <Pressable
            onPress={handlePickImage}
            style={({ pressed }) => [
              {
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="photo" size={18} color={colors.muted} />
          </Pressable>
          <TextInput
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 15,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: message.trim() ? colors.primary : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={18} color={message.trim() ? "#FFF" : colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

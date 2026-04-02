import { useState } from "react";
import { Text, View, Pressable, TextInput, ScrollView, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId, generateInvitationCode } from "@/lib/app-provider";
import { GroupType, GroupMember } from "@/lib/types";
import { partyTemplates, PartyTemplate } from "@/lib/party-templates";
import { trpc } from "@/lib/trpc";

export default function CreateScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const createGroupMutation = trpc.groups.create.useMutation();
  const addTaskMutation = trpc.tasks.add.useMutation();
  const addShoppingItemMutation = trpc.shopping.add.useMutation();
  const addPollMutation = trpc.polls.add.useMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<GroupType>("classic");
  const [expiresDate, setExpiresDate] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const formatDate = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
  };

  const formatTime = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  };
  const [selectedTemplate, setSelectedTemplate] = useState<PartyTemplate | null>(null);

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const applyTemplate = (template: PartyTemplate) => {
    if (selectedTemplate?.id === template.id) {
      setSelectedTemplate(null);
      return;
    }
    setSelectedTemplate(template);
    if (!name.trim()) setName(`${template.name}`);
    if (!description.trim()) setDescription(template.description);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      if (Platform.OS === "web") alert("Veuillez entrer un nom pour le groupe");
      else Alert.alert("Erreur", "Veuillez entrer un nom pour le groupe");
      return;
    }

    const members: GroupMember[] = [
      {
        id: state.profile?.id || "user_1",
        name: state.profile?.name || "Moi",
        username: state.profile?.username || "me",
        avatar: "",
        rsvp: "present",
        role: "admin",
      },
      ...selectedFriends.map((fId) => {
        const friend = state.friends.find((f) => f.id === fId);
        return {
          id: fId,
          name: friend?.name || "Ami",
          username: friend?.username || "",
          avatar: "",
          rsvp: "pending" as const,
          role: "member" as const,
        };
      }),
    ];

    const groupId = generateId();
    let eventDateObj: Date;
    if (date) {
      const frMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (frMatch) {
        eventDateObj = new Date(parseInt(frMatch[3]), parseInt(frMatch[2]) - 1, parseInt(frMatch[1]));
      } else {
        eventDateObj = new Date(date);
      }
    } else {
      eventDateObj = new Date(Date.now() + 7 * 86400000);
    }

    let expiresAtDate: Date | undefined;
    if (type === "auto-destruct") {
      if (expiresDate) {
        const frMatch = expiresDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (frMatch) {
          expiresAtDate = new Date(parseInt(frMatch[3]), parseInt(frMatch[2]) - 1, parseInt(frMatch[1]));
        } else {
          expiresAtDate = new Date(expiresDate);
        }
      } else {
        expiresAtDate = new Date(Date.now() + 3 * 86400000);
      }
    }

    const invitationCode = generateInvitationCode();

    // Pré-génère les IDs des items du template pour pouvoir les référencer
    // dans le dispatch local ET dans le syncPayload (retry backend)
    const templateTasks = (selectedTemplate?.suggestedTasks ?? []).map((task) => ({
      externalId: generateId(),
      title: task.title,
      priority: task.priority,
    }));
    const templateShoppingItems = (selectedTemplate?.suggestedShopping ?? []).map((item) => ({
      externalId: generateId(),
      name: item.name,
      price: String(item.price),
    }));
    const templatePolls = (selectedTemplate?.suggestedPolls ?? []).map((poll) => ({
      externalId: generateId(),
      question: poll.question,
      // JSON stringifié de PollOption[] attendu par le router
      options: JSON.stringify(poll.options.map((text) => ({ id: generateId(), text, votes: [] }))),
    }));

    const isAuthenticated = !!(state.profile?.id && !state.profile.id.startsWith("guest-"));

    dispatch({
      type: "ADD_GROUP",
      payload: {
        id: groupId,
        name: name.trim(),
        description: description.trim(),
        type,
        coverImage: "",
        date: eventDateObj.toISOString(),
        time: time || "20:00",
        location: location.trim() || "À définir",
        createdBy: state.profile?.id || "user_1",
        createdAt: new Date().toISOString(),
        expiresAt: expiresAtDate ? expiresAtDate.toISOString() : undefined,
        invitationCode,
        members,
        syncStatus: isAuthenticated ? "pending" : "synced",
        syncPayload: isAuthenticated
          ? {
              name: name.trim(),
              description: description.trim() || undefined,
              type,
              date: eventDateObj.toISOString(),
              time: time || "20:00",
              location: location.trim() || undefined,
              shareCode: invitationCode,
              tasks: templateTasks,
              shoppingItems: templateShoppingItems,
              polls: templatePolls,
            }
          : undefined,
      },
    });

    // Apply template items locally avec les IDs pré-générés
    templateTasks.forEach((task) => {
      dispatch({
        type: "ADD_TASK",
        payload: {
          id: task.externalId,
          groupId,
          title: task.title,
          priority: task.priority,
          completed: false,
          createdAt: new Date().toISOString(),
        },
      });
    });
    templateShoppingItems.forEach((item) => {
      dispatch({
        type: "ADD_SHOPPING_ITEM",
        payload: {
          id: item.externalId,
          groupId,
          name: item.name,
          status: "to_buy",
          price: parseFloat(item.price),
          addedBy: state.profile?.id || "user_1",
          createdAt: new Date().toISOString(),
        },
      });
    });
    templatePolls.forEach((poll) => {
      dispatch({
        type: "ADD_POLL",
        payload: {
          id: poll.externalId,
          groupId,
          question: poll.question,
          createdBy: state.profile?.id || "user_1",
          createdAt: new Date().toISOString(),
          options: JSON.parse(poll.options),
        },
      });
    });

    // Sync vers le backend
    if (isAuthenticated) {
      createGroupMutation.mutate(
        {
          externalId: groupId,
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          date: eventDateObj.toISOString(),
          time: time || "20:00",
          location: location.trim() || undefined,
          shareCode: invitationCode,
        },
        {
          onSuccess: (data) => {
            const backendGroupId = data.id;
            dispatch({
              type: "UPDATE_GROUP",
              payload: { id: groupId, updates: { syncStatus: "synced", syncPayload: undefined } },
            });
            // Sync les items du template vers le backend
            templateTasks.forEach((task) => {
              addTaskMutation.mutate({
                externalId: task.externalId,
                groupId: backendGroupId,
                title: task.title,
                priority: task.priority,
              });
            });
            templateShoppingItems.forEach((item) => {
              addShoppingItemMutation.mutate({
                externalId: item.externalId,
                groupId: backendGroupId,
                name: item.name,
                price: item.price,
              });
            });
            templatePolls.forEach((poll) => {
              addPollMutation.mutate({
                externalId: poll.externalId,
                groupId: backendGroupId,
                question: poll.question,
                options: poll.options,
              });
            });
          },
          onError: (err) => {
            console.error("[Create] Failed to sync group to backend:", err.message);
            dispatch({
              type: "UPDATE_GROUP",
              payload: { id: groupId, updates: { syncStatus: "failed" } },
            });
          },
        },
      );
    }

    dispatch({
      type: "ADD_NOTIFICATION",
      payload: {
        id: generateId(),
        type: "reminder",
        title: "Groupe créé",
        message: `Le groupe "${name.trim()}" a été créé${selectedTemplate ? ` avec le thème ${selectedTemplate.name}` : ""} !`,
        groupId,
        read: false,
        createdAt: new Date().toISOString(),
      },
    });

    // Reset form
    setName("");
    setDescription("");
    setLocation("");
    setDate("");
    setTime("");
    setType("classic");
    setExpiresDate("");
    setSelectedFriends([]);
    setSelectedTemplate(null);

    router.push(`/group/${groupId}` as any);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-2 pb-4">
          <Text className="text-foreground text-2xl font-bold">Créer une soirée</Text>
          <Text className="text-muted text-sm mt-1">Organisez votre prochain événement</Text>
        </View>

        {/* Party Templates */}
        <View className="px-5 mb-5">
          <Text className="text-foreground font-semibold mb-3">Choisir un thème</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 10 }}>
            {partyTemplates.map((template) => {
              const isActive = selectedTemplate?.id === template.id;
              return (
                <Pressable
                  key={template.id}
                  onPress={() => applyTemplate(template)}
                  style={({ pressed }) => [
                    {
                      width: 110,
                      marginRight: 10,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: isActive ? template.color : colors.border,
                      backgroundColor: isActive ? template.color + "15" : colors.surface,
                      alignItems: "center",
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={{ fontSize: 32, marginBottom: 6 }}>{template.icon}</Text>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: isActive ? template.color : colors.foreground,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {template.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selectedTemplate && (
            <View
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: selectedTemplate.color + "10",
                borderWidth: 1,
                borderColor: selectedTemplate.color + "30",
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {selectedTemplate.icon} Thème {selectedTemplate.name} sélectionné
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                {selectedTemplate.suggestedTasks.length} tâches, {selectedTemplate.suggestedShopping.length} articles et {selectedTemplate.suggestedPolls.length} sondages seront ajoutés automatiquement.
              </Text>
            </View>
          )}
        </View>

        {/* Type Selection */}
        <View className="px-5 mb-5">
          <Text className="text-foreground font-semibold mb-3">Type de groupe</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setType("classic")}
              style={({ pressed }) => [
                {
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: type === "classic" ? colors.primary : colors.border,
                  backgroundColor: type === "classic" ? colors.primary + "10" : colors.surface,
                  alignItems: "center",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontSize: 28, marginBottom: 6 }}>🎉</Text>
              <Text style={{ fontWeight: "700", color: type === "classic" ? colors.primary : colors.foreground, fontSize: 14 }}>
                Classique
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
                Permanent
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType("auto-destruct")}
              style={({ pressed }) => [
                {
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: type === "auto-destruct" ? "#F97316" : colors.border,
                  backgroundColor: type === "auto-destruct" ? "#F9731610" : colors.surface,
                  alignItems: "center",
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={{ fontSize: 28, marginBottom: 6 }}>⏳</Text>
              <Text style={{ fontWeight: "700", color: type === "auto-destruct" ? "#F97316" : colors.foreground, fontSize: 14 }}>
                Auto-Destructible
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 }}>
                Données supprimées après
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Form Fields */}
        <View className="px-5 gap-4">
          <View>
            <Text className="text-foreground font-semibold mb-2">Nom de la soirée *</Text>
            <TextInput
              placeholder="Ex: Soirée Anniversaire"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-2">Description</Text>
            <TextInput
              placeholder="Décrivez votre événement..."
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-2">Lieu</Text>
            <TextInput
              placeholder="Ex: Chez Sophie, 15 rue de la Paix"
              placeholderTextColor={colors.muted}
              value={location}
              onChangeText={setLocation}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                color: colors.foreground,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text className="text-foreground font-semibold mb-2">Date</Text>
              <TextInput
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={10}
                value={date}
                onChangeText={(t) => setDate(formatDate(t))}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-foreground font-semibold mb-2">Heure</Text>
              <TextInput
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={5}
                value={time}
                onChangeText={(t) => setTime(formatTime(t))}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
          </View>

          {type === "auto-destruct" && (
            <View>
              <Text className="text-foreground font-semibold mb-2">Date d'expiration</Text>
              <TextInput
                placeholder="JJ/MM/AAAA (suppression auto)"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={10}
                value={expiresDate}
                onChangeText={(t) => setExpiresDate(formatDate(t))}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: "#F97316",
                }}
              />
              <Text style={{ color: "#F97316", fontSize: 11, marginTop: 4 }}>
                Toutes les données seront supprimées à cette date
              </Text>
            </View>
          )}

          {/* Friends Selection */}
          <View>
            <Text className="text-foreground font-semibold mb-3">Inviter des amis</Text>
            {state.friends.length === 0 ? (
              <Text className="text-muted text-sm">Aucun ami ajouté pour le moment</Text>
            ) : (
              state.friends.map((friend) => {
                const isSelected = selectedFriends.includes(friend.id);
                return (
                  <Pressable
                    key={friend.id}
                    onPress={() => toggleFriend(friend.id)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 6,
                        backgroundColor: isSelected ? colors.primary + "15" : colors.surface,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.primary + "30",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.primary }}>{friend.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-foreground font-semibold text-sm">{friend.name}</Text>
                      <Text className="text-muted text-xs">@{friend.username}</Text>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && <IconSymbol name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* Create Button */}
        <View className="px-5 mt-6">
          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
              },
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>
              Créer le groupe
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

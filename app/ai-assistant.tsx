import { useState, useRef } from "react";
import { Text, View, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";

interface AIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

const AI_SUGGESTIONS = [
  "Suggère un thème de soirée",
  "Idées de cocktails faciles",
  "Playlist pour une soirée",
  "Jeux de soirée amusants",
  "Idées de déco pas cher",
  "Menu pour 10 personnes",
];

const AI_RESPONSES: Record<string, string> = {
  "thème": "Voici quelques thèmes de soirée populaires :\n\n🌴 **Soirée Tropicale** — Déco exotique, cocktails fruités, musique reggaeton\n\n🎭 **Soirée Masquerade** — Masques vénitiens, dress code élégant, musique classique revisitée\n\n🕺 **Années 80** — Néons, synthwave, déguisements rétro\n\n🎬 **Soirée Cinéma** — Chaque invité vient déguisé en personnage de film\n\n🌌 **Soirée Étoilée** — Déco lumineuse, projection d'étoiles, ambiance chill",
  "cocktail": "Voici 5 cocktails faciles à préparer :\n\n🍹 **Mojito** — Rhum, menthe, citron vert, sucre, eau gazeuse\n\n🍊 **Spritz** — Prosecco, Aperol, eau gazeuse, tranche d'orange\n\n🫐 **Gin Tonic Fruité** — Gin, tonic, fruits rouges, romarin\n\n🥥 **Piña Colada** — Rhum, jus d'ananas, lait de coco\n\n🍋 **Margarita** — Tequila, triple sec, jus de citron vert",
  "playlist": "Voici une playlist parfaite pour votre soirée :\n\n🎵 **Warm-up** (19h-21h)\n— Dua Lipa, The Weeknd, Doja Cat\n\n🔥 **Peak Time** (21h-00h)\n— Bad Bunny, Drake, Aya Nakamura\n\n🌙 **Late Night** (00h-2h)\n— Frank Ocean, SZA, Daniel Caesar\n\n💡 Astuce : Créez une playlist collaborative sur Spotify pour que chacun ajoute ses titres !",
  "jeux": "Voici des jeux de soirée incontournables :\n\n🃏 **Loup-Garou** — Le classique indémodable (5-18 joueurs)\n\n🍺 **Beer Pong** — Le tournoi de la soirée\n\n🎤 **Blind Test Musical** — Devinez la chanson en 5 secondes\n\n🤔 **Action ou Vérité** — Version adulte avec des défis fun\n\n📱 **Picolo** — L'app qui génère des défis hilarants\n\n🎯 **Kings** — Jeu de cartes à boire (avec modération !)",
  "déco": "Idées de déco pas cher pour votre soirée :\n\n💡 **Guirlandes LED** — 5€ sur Amazon, effet garanti\n\n🎈 **Ballons** — Gonflez-en plein et dispersez-les au sol\n\n🕯️ **Bougies LED** — Ambiance tamisée sans risque\n\n📸 **Coin Photo** — Un drap + des accessoires rigolos\n\n🌿 **Plantes** — Empruntez celles de vos amis pour la soirée\n\n💰 Budget total estimé : 15-25€",
  "menu": "Menu pour 10 personnes (budget ~50€) :\n\n🥗 **Entrée** — Bruschetta tomates-basilic + houmous maison\n\n🍕 **Plat** — Pizzas maison (3 grandes) ou wraps variés\n\n🧀 **Plateau** — Fromages + charcuterie + fruits secs\n\n🍰 **Dessert** — Brownies maison + fruits frais\n\n🥤 **Boissons** — Sangria maison + softs\n\n💡 Astuce : Utilisez la liste de courses Ravvy pour répartir les achats !",
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(AI_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return `Excellente question ! Voici mes suggestions pour "${input}" :\n\n1. Commencez par définir le thème et l'ambiance souhaitée\n2. Établissez un budget par personne\n3. Utilisez les modules Ravvy pour organiser les tâches\n4. N'oubliez pas de créer un sondage pour les préférences\n\n💡 Utilisez le module Courses pour répartir les achats entre participants !`;
}

export default function AIAssistantScreen() {
  const colors = useColors();
  const router = useRouter();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Salut ! 👋 Je suis l'assistant Ravvy. Je peux vous aider à organiser votre soirée parfaite. Posez-moi une question ou choisissez une suggestion ci-dessous !",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const handleSend = (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: "user",
      text: msgText,
      timestamp: new Date().toISOString(),
    };

    const aiMsg: AIMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: getAIResponse(msgText),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text className="text-foreground font-bold text-base">Assistant IA</Text>
              <IconSymbol name="sparkles" size={16} color="#F59E0B" />
            </View>
            <Text className="text-muted text-xs">Votre organisateur de soirée intelligent</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          renderItem={({ item: msg }) => {
            const isUser = msg.role === "user";
            return (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  marginBottom: 10,
                }}
              >
                {!isUser && (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#F59E0B" + "25",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    <IconSymbol name="sparkles" size={16} color="#F59E0B" />
                  </View>
                )}
                <View
                  style={{
                    maxWidth: "78%",
                    backgroundColor: isUser ? colors.primary : colors.surface,
                    borderRadius: 16,
                    borderTopLeftRadius: isUser ? 16 : 4,
                    borderTopRightRadius: isUser ? 4 : 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: isUser ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: isUser ? "#FFF" : colors.foreground,
                      fontSize: 14,
                      lineHeight: 21,
                    }}
                  >
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            messages.length <= 1 ? (
              <View style={{ marginTop: 10 }}>
                <Text className="text-muted text-xs font-semibold mb-2">Suggestions</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {AI_SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => handleSend(s)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.primary + "10",
                          borderRadius: 16,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: colors.primary + "30",
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "500" }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 12,
            paddingVertical: 8,
            paddingBottom: Platform.OS === "web" ? 12 : 30,
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            gap: 8,
          }}
        >
          <TextInput
            placeholder="Demandez-moi n'importe quoi..."
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
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
            onPress={() => handleSend()}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: input.trim() ? "#F59E0B" : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
          >
            <IconSymbol name="paperplane.fill" size={18} color={input.trim() ? "#FFF" : colors.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

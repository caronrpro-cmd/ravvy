import { useState, useRef } from "react";
import { Text, View, Pressable, Dimensions, FlatList } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

const { width } = Dimensions.get("window");

const slides = [
  {
    title: "Bienvenue sur Ravvy",
    subtitle: "Organise tes soirées avec tes amis, simplement.",
    color: "#F59E0B",
    showLogo: true,
  },
  {
    title: "Tout au même endroit",
    subtitle: "Courses, covoit, chat, tâches, sondages... tout est partagé et synchronisé.",
    color: "#3D4F5F",
    showLogo: false,
    emoji: "🤝",
  },
  {
    title: "Rentre en sécurité",
    subtitle: "Partage ta position, utilise le bouton SOS. Tes amis veillent.",
    color: "#10B981",
    showLogo: false,
    emoji: "🛡️",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace("/login" as any);
    }
  };

  const handleSkip = () => {
    router.replace("/login" as any);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={{ flex: 1 }}>
        {/* Skip button */}
        <View style={{ alignItems: "flex-end", paddingHorizontal: 20, paddingTop: 10 }}>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "500" }}>Passer</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <View
              style={{
                width,
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 40,
              }}
            >
              {item.showLogo ? (
                <Image
                  source={require("@/assets/images/icon.png")}
                  style={{ width: 120, height: 120, borderRadius: 30, marginBottom: 30 }}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 30,
                    backgroundColor: item.color + "15",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 30,
                  }}
                >
                  <Text style={{ fontSize: 56 }}>{item.emoji}</Text>
                </View>
              )}
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: colors.foreground,
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.muted,
                  textAlign: "center",
                  lineHeight: 24,
                }}
              >
                {item.subtitle}
              </Text>
            </View>
          )}
        />

        {/* Dots & Button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
          {/* Dots */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: currentIndex === i ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: currentIndex === i ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>

          {/* Button */}
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              {
                backgroundColor: slides[currentIndex].color,
                borderRadius: 16,
                padding: 18,
                alignItems: "center",
              },
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 17 }}>
              {currentIndex === slides.length - 1 ? "Commencer" : "Suivant"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

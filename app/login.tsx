import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { useState, useEffect } from "react";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";

// TODO: Google Sign-In nécessite un dev client natif (pas Expo Go)
// Décommenter quand on build avec EAS :
// import * as Google from "expo-auth-session/providers/google";
// import * as WebBrowser from "expo-web-browser";
// WebBrowser.maybeCompleteAuthSession();

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState<"email" | "apple" | "guest" | null>(null);
  const [cguAccepted, setCguAccepted] = useState(false);

  useEffect(() => {
    if (state.profile?.id) {
      router.replace("/(tabs)");
    }
  }, [state.profile?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const applySession = async (token: string, user: any) => {
    await Auth.setSessionToken(token);
    const userInfo: Auth.User = {
      id: user.id,
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      lastSignedIn: new Date(user.lastSignedIn || Date.now()),
    };
    await Auth.setUserInfo(userInfo);
    dispatch({
      type: "SET_PROFILE",
      payload: {
        id: String(user.id),
        name: user.name || "Utilisateur",
        username: user.email?.split("@")[0] || "utilisateur",
        bio: "",
        avatar: "",
        status: "available",
        createdAt: new Date().toISOString(),
      },
    });
    dispatch({ type: "COMPLETE_ONBOARDING" });
    setLoading(null);
    // Navigation handled by the useEffect watching state.profile?.id
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Erreur", "Veuillez remplir l'email et le mot de passe.");
      return;
    }
    setLoading("email");
    try {
      const result = await Api.loginWithEmail(email.trim(), password);
      await applySession(result.token, result.user);
    } catch (err: any) {
      const msg = err?.message || "Email ou mot de passe incorrect.";
      Alert.alert("Connexion échouée", msg);
      setLoading(null);
    }
  };

  const handleEmailSignup = async () => {
    if (!name.trim() || !email.trim() || !username.trim() || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!cguAccepted) {
      Alert.alert("CGU requises", "Veuillez accepter les Conditions d'Utilisation pour créer un compte.");
      return;
    }
    setLoading("email");
    try {
      const result = await Api.registerWithEmail(name.trim(), email.trim(), password);
      await applySession(result.token, { ...result.user, name: name.trim() });
    } catch (err: any) {
      const msg = err?.message || "Impossible de créer le compte.";
      Alert.alert("Inscription échouée", msg);
      setLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== "ios") return;
    setLoading("apple");
    try {
      // Lazy-load to avoid issues on non-iOS platforms
      const AppleAuthentication = require("expo-apple-authentication");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const result = await Api.loginWithApple(
        credential.identityToken!,
        credential.fullName,
      );
      await applySession(result.token, result.user);
    } catch (err: any) {
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Erreur Apple", err?.message || "Connexion Apple échouée.");
      }
      setLoading(null);
    }
  };

  // TODO: Google Sign-In — décommenter avec EAS build
  // const handleGoogleSignIn = async () => { ... };

  const handleContinueAsGuest = () => {
    dispatch({
      type: "SET_PROFILE",
      payload: {
        id: "guest-" + Date.now(),
        name: "Utilisateur",
        username: "utilisateur",
        bio: "",
        avatar: "",
        status: "available",
        createdAt: new Date().toISOString(),
      },
    });
    dispatch({ type: "COMPLETE_ONBOARDING" });
    router.replace("/(tabs)");
  };

  const isLoading = loading !== null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 100, height: 100, borderRadius: 22, marginBottom: 16 }}
            contentFit="contain"
          />
          <Text style={{ fontSize: 32, fontWeight: "800", color: colors.foreground, letterSpacing: -1 }}>
            Ravvy
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 4 }}>
            On rave ce soir.
          </Text>
        </View>

        {/* Social Sign-In (iOS: Apple, always: Google) */}
        <View style={{ gap: 10, marginBottom: 20 }}>
          {Platform.OS === "ios" && (
            <Pressable
              onPress={handleAppleSignIn}
              disabled={isLoading}
              accessibilityLabel="Continuer avec Apple"
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  backgroundColor: colors.foreground,
                  borderRadius: 12,
                  paddingVertical: 14,
                  opacity: isLoading && loading !== "apple" ? 0.5 : 1,
                },
                pressed && !isLoading && { opacity: 0.8 },
              ]}
            >
              {loading === "apple" ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Text style={{ fontSize: 18, color: colors.background }}></Text>
                  <Text style={{ color: colors.background, fontWeight: "700", fontSize: 15 }}>
                    Continuer avec Apple
                  </Text>
                </>
              )}
            </Pressable>
          )}

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>ou</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Email form */}
        <View style={{ marginBottom: 20 }}>
          {/* Mode toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 4,
              marginBottom: 16,
            }}
          >
            {(["login", "signup"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                accessibilityLabel={m === "login" ? "Connexion" : "Inscription"}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 9,
                  backgroundColor: mode === m ? colors.primary : "transparent",
                }}
              >
                <Text style={{ color: mode === m ? "#FFF" : colors.foreground, fontWeight: "600", fontSize: 14 }}>
                  {m === "login" ? "Connexion" : "Inscription"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Email */}
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            accessibilityLabel="Adresse email"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 10,
              color: colors.foreground,
              fontSize: 15,
            }}
          />

          {mode === "signup" && (
            <>
              <TextInput
                placeholder="Nom complet"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                editable={!isLoading}
                accessibilityLabel="Nom complet"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 10,
                  color: colors.foreground,
                  fontSize: 15,
                }}
              />
              <TextInput
                placeholder="Nom d'utilisateur"
                placeholderTextColor={colors.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel="Nom d'utilisateur"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 10,
                  color: colors.foreground,
                  fontSize: 15,
                }}
              />
            </>
          )}

          {/* Password */}
          <TextInput
            placeholder="Mot de passe"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
            accessibilityLabel="Mot de passe"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: mode === "signup" ? 12 : 16,
              color: colors.foreground,
              fontSize: 15,
            }}
          />

          {/* CGU checkbox (signup only) */}
          {mode === "signup" && (
            <Pressable
              onPress={() => setCguAccepted(!cguAccepted)}
              accessibilityLabel="Accepter les conditions d'utilisation"
              accessibilityRole="checkbox"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: cguAccepted ? colors.primary : colors.border,
                  backgroundColor: cguAccepted ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cguAccepted && (
                  <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>✓</Text>
                )}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                J'accepte les{" "}
                <Text
                  style={{ color: colors.primary, textDecorationLine: "underline" }}
                  onPress={() => router.push("/legal/terms" as any)}
                >
                  Conditions d'Utilisation
                </Text>
                {" "}et la{" "}
                <Text
                  style={{ color: colors.primary, textDecorationLine: "underline" }}
                  onPress={() => router.push("/legal/privacy" as any)}
                >
                  Politique de confidentialité
                </Text>
              </Text>
            </Pressable>
          )}

          {/* Submit */}
          <Pressable
            onPress={mode === "login" ? handleEmailLogin : handleEmailSignup}
            disabled={isLoading}
            accessibilityLabel={mode === "login" ? "Se connecter" : "Créer un compte"}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                opacity: isLoading && loading !== "email" ? 0.5 : 1,
              },
              pressed && !isLoading && { opacity: 0.8 },
            ]}
          >
            {loading === "email" ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                {mode === "login" ? "Se connecter" : "Créer un compte"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Guest */}
        <Pressable
          onPress={handleContinueAsGuest}
          disabled={isLoading}
          accessibilityLabel="Continuer sans compte"
          accessibilityRole="button"
          style={({ pressed }) => [
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              opacity: isLoading && loading !== "guest" ? 0.5 : 1,
            },
            pressed && !isLoading && { opacity: 0.8 },
          ]}
        >
          {loading === "guest" ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
              Continuer sans compte
            </Text>
          )}
        </Pressable>

        {/* Legal links */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 20 }}>
          <Text
            style={{ color: colors.muted, fontSize: 11, textDecorationLine: "underline" }}
            onPress={() => router.push("/legal/privacy" as any)}
          >
            Politique de confidentialité
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 11, textDecorationLine: "underline" }}
            onPress={() => router.push("/legal/terms" as any)}
          >
            Conditions d'utilisation
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

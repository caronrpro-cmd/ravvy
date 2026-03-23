import { useState } from "react";
import { Text, View, Pressable, ScrollView, Alert, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";

export default function DeleteAccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const { dispatch } = useApp();
  const [step, setStep] = useState<"confirm" | "final">("confirm");

  const requestDeletion = trpc.profile.requestDeletion.useMutation();
  const deleteAccount = trpc.profile.deleteAccount.useMutation();

  const isLoading = requestDeletion.isPending || deleteAccount.isPending;

  const handleRequestDeletion = () => {
    const doRequest = async () => {
      try {
        await requestDeletion.mutateAsync();
        setStep("final");
      } catch {
        Alert.alert("Erreur", "Impossible de traiter votre demande. Réessayez plus tard.");
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.")) {
        doRequest();
      }
    } else {
      Alert.alert(
        "Supprimer le compte",
        "Êtes-vous sûr de vouloir supprimer votre compte ? Toutes vos données seront définitivement effacées.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Confirmer", style: "destructive", onPress: doRequest },
        ]
      );
    }
  };

  const handleDeleteNow = async () => {
    const doDelete = async () => {
      try {
        await deleteAccount.mutateAsync();
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        dispatch({ type: "LOGOUT" });
        router.replace("/onboarding" as any);
      } catch {
        Alert.alert("Erreur", "Impossible de supprimer le compte. Réessayez plus tard.");
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Dernière confirmation : supprimer définitivement votre compte et toutes vos données ?")) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Suppression définitive",
        "Cette action est irréversible. Toutes vos données seront supprimées immédiatement.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer définitivement", style: "destructive", onPress: doDelete },
        ]
      );
    }
  };

  const handleCancel = async () => {
    try {
      await requestDeletion.reset();
      router.back();
    } catch {
      router.back();
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
          Suppression du compte
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Warning icon */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.error + "15",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconSymbol name="trash.fill" size={36} color={colors.error} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>
            {step === "confirm" ? "Supprimer mon compte" : "Demande enregistrée"}
          </Text>
        </View>

        {step === "confirm" ? (
          <>
            {/* What will be deleted */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
                Ce qui sera supprimé :
              </Text>
              {[
                "Votre profil et informations personnelles",
                "Tous vos groupes et événements créés",
                "Vos messages et photos partagés",
                "Vos listes de courses et tâches",
                "Vos données de covoiturage",
                "Votre liste d'amis",
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error }} />
                  <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>

            {/* GDPR info */}
            <View style={{ backgroundColor: colors.primary + "10", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary + "30", marginBottom: 28 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
                Conformité RGPD
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
                Conformément au RGPD (Règlement Général sur la Protection des Données), vous avez le droit à l'effacement de vos données. La suppression sera effective dans un délai de 30 jours.
              </Text>
            </View>

            {/* Action buttons */}
            <Pressable
              onPress={handleRequestDeletion}
              disabled={isLoading}
              accessibilityLabel="Supprimer mon compte"
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.error,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                  marginBottom: 12,
                },
                pressed && !isLoading && { opacity: 0.8 },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                  Supprimer mon compte
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleCancel}
              accessibilityLabel="Annuler"
              accessibilityRole="button"
              style={({ pressed }) => [
                { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 15 }}>Annuler</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Confirmation state */}
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 28 }}>
              Votre demande de suppression a été enregistrée. Vos données seront supprimées dans 30 jours.{"\n\n"}
              Si vous souhaitez annuler cette demande, reconnectez-vous et accédez à nouveau à cette page.
            </Text>

            <Pressable
              onPress={handleDeleteNow}
              disabled={isLoading}
              accessibilityLabel="Supprimer immédiatement"
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.error,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                  marginBottom: 12,
                },
                pressed && !isLoading && { opacity: 0.8 },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                  Supprimer immédiatement
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Retour aux paramètres"
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
                Retour aux paramètres
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

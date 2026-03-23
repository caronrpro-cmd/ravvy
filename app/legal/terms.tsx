import React from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TermsScreen() {
  const colors = useColors();
  const router = useRouter();

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
          Conditions d'utilisation
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 20 }}>
          Dernière mise à jour : 22 mars 2026
        </Text>

        <Section title="1. Acceptation des conditions" colors={colors}>
          En utilisant Ravvy, vous acceptez les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.
        </Section>

        <Section title="2. Description du service" colors={colors}>
          Ravvy est une application mobile permettant d'organiser des événements et soirées entre amis. Elle propose des fonctionnalités de gestion de groupes, de chat, de listes de courses, de covoiturage, de tâches et de sondages.
        </Section>

        <Section title="3. Compte utilisateur" colors={colors}>
          Vous êtes responsable de la confidentialité de vos identifiants de connexion. Vous devez être âgé(e) d'au moins 13 ans pour utiliser Ravvy. Toute activité réalisée depuis votre compte est sous votre responsabilité.
        </Section>

        <Section title="4. Comportement des utilisateurs" colors={colors}>
          Il est interdit d'utiliser Ravvy pour :
          {"\n\n"}• Publier du contenu illégal, diffamatoire ou offensant
          {"\n"}• Harceler d'autres utilisateurs
          {"\n"}• Usurper l'identité d'une autre personne
          {"\n"}• Tenter de compromettre la sécurité de l'application
          {"\n"}• Distribuer des spams ou messages non sollicités
        </Section>

        <Section title="5. Contenu utilisateur" colors={colors}>
          Vous conservez la propriété du contenu que vous publiez. En partageant du contenu dans Ravvy, vous accordez à l'application une licence limitée pour afficher ce contenu aux membres de vos groupes.
        </Section>

        <Section title="6. Disponibilité du service" colors={colors}>
          Nous nous efforçons de maintenir Ravvy disponible en permanence, mais nous ne garantissons pas une disponibilité ininterrompue. Des maintenances peuvent occasionner des interruptions temporaires.
        </Section>

        <Section title="7. Suppression du compte" colors={colors}>
          Vous pouvez supprimer votre compte à tout moment depuis les paramètres de l'application. La suppression entraîne l'effacement définitif de vos données dans un délai de 30 jours conformément au RGPD.
        </Section>

        <Section title="8. Modifications des CGU" colors={colors}>
          Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications importantes vous seront notifiées via l'application. L'utilisation continue de Ravvy après notification vaut acceptation des nouvelles conditions.
        </Section>

        <Section title="9. Limitation de responsabilité" colors={colors}>
          Ravvy est fourni "tel quel". Nous déclinons toute responsabilité concernant les dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
        </Section>

        <Section title="10. Contact" colors={colors}>
          Pour toute question relative aux présentes conditions :
          {"\n\n"}Email : legal@ravvy.app
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

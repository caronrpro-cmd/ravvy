import React from "react";
import { Text, View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function PrivacyPolicyScreen() {
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
          Politique de confidentialité
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 20 }}>
          Dernière mise à jour : 22 mars 2026
        </Text>

        <Section title="1. Collecte des données" colors={colors}>
          Ravvy collecte uniquement les données nécessaires au bon fonctionnement de l'application :
          {"\n\n"}• Informations de compte (nom, email, identifiant)
          {"\n"}• Données des groupes et événements que vous créez ou rejoignez
          {"\n"}• Messages envoyés dans les groupes
          {"\n"}• Position géographique (uniquement lorsque activée par l'utilisateur)
          {"\n"}• Photos partagées dans les groupes
        </Section>

        <Section title="2. Utilisation des données" colors={colors}>
          Vos données sont utilisées exclusivement pour :
          {"\n\n"}• Fournir et améliorer les fonctionnalités de Ravvy
          {"\n"}• Synchroniser vos groupes et événements entre appareils
          {"\n"}• Envoyer des notifications liées à vos événements
          {"\n\n"}Nous ne vendons ni ne partageons vos données personnelles avec des tiers à des fins commerciales.
        </Section>

        <Section title="3. Stockage et sécurité" colors={colors}>
          Vos données sont stockées sur des serveurs sécurisés. Les communications entre votre appareil et nos serveurs sont chiffrées via HTTPS. Les mots de passe sont hachés et ne sont jamais stockés en clair.
        </Section>

        <Section title="4. Vos droits (RGPD)" colors={colors}>
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
          {"\n\n"}• Droit d'accès à vos données personnelles
          {"\n"}• Droit de rectification
          {"\n"}• Droit à l'effacement (droit à l'oubli)
          {"\n"}• Droit à la portabilité
          {"\n"}• Droit d'opposition
          {"\n\n"}Pour exercer ces droits, utilisez la fonction "Suppression de compte" dans les paramètres de l'application ou contactez-nous à privacy@ravvy.app
        </Section>

        <Section title="5. Conservation des données" colors={colors}>
          Vos données sont conservées pendant la durée d'utilisation de votre compte. Après suppression du compte, vos données sont définitivement effacées dans un délai de 30 jours.
        </Section>

        <Section title="6. Cookies et traceurs" colors={colors}>
          L'application mobile n'utilise pas de cookies. La version web utilise uniquement des cookies techniques nécessaires à l'authentification.
        </Section>

        <Section title="7. Contact" colors={colors}>
          Pour toute question relative à la protection de vos données personnelles :
          {"\n\n"}Email : privacy@ravvy.app
          {"\n"}Responsable : Équipe Ravvy
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

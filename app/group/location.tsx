import { useState, useEffect, useCallback, useRef } from "react";
import { Text, View, Pressable, ScrollView, Alert, Platform, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { formatRelativeTime } from "@/lib/helpers";
import { MapView as PlatformMapView, Marker as PlatformMarker, Circle as PlatformCircle, isMapAvailable } from "@/components/map-view";
import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";
import { useSSE } from "@/hooks/use-sse";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";

interface LiveLocation {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

interface MemberLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lastUpdate: string;
  isSharing: boolean;
  initial: string;
}

export default function LocationScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const mapRef = useRef<any>(null);

  const SHARING_KEY = `ravvy_sharing_${groupId}`;
  const [sharing, setSharing] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosCooldown, setSosCooldown] = useState(0); // secondes restantes avant prochain envoi
  const sosCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  // Positions en temps réel des autres membres (via SSE)
  const [liveLocations, setLiveLocations] = useState<Map<string, LiveLocation>>(new Map());

  // Restore sharing state from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(SHARING_KEY).then((val) => {
      if (val === "true") setSharing(true);
    });
  }, [SHARING_KEY]);

  // Persist sharing state whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(SHARING_KEY, sharing ? "true" : "false");
  }, [sharing, SHARING_KEY]);

  const group = state.groups.find((g) => g.id === groupId);

  // Récupère l'ID numérique backend du groupe
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  const locationUpdateMutation = trpc.location.update.useMutation();
  const sosMutation = trpc.notifications.sos.useMutation();

  // SSE : alerte SOS reçue d'un autre membre
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "sos") {
      Alert.alert("🆘 ALERTE SOS", "Un membre du groupe a déclenché une alerte SOS !", [{ text: "OK" }]);
    }
  });

  // Poll location.list every 5s to get other members' positions (also initializes on mount)
  const locationListQuery = trpc.location.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000 }
  );

  // Sync location list into app state and local liveLocations
  useEffect(() => {
    if (!locationListQuery.data || !groupId) return;
    const entries = locationListQuery.data as Array<{ userId: string; name: string; lat: number; lng: number; updatedAt: string }>;
    dispatch({ type: "SET_GROUP_LOCATIONS", payload: { groupId: groupId!, locations: entries } });
    setLiveLocations((prev) => {
      const next = new Map(prev);
      entries.forEach((e) => next.set(e.userId, e));
      return next;
    });
  }, [locationListQuery.data, groupId]);

  // ===== GPS WATCHER =====
  // Stocke la ref du watcher natif ou l'ID du watcher web
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const webWatcherRef = useRef<number | null>(null);

  const stopWatcher = useCallback(() => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    if (webWatcherRef.current !== null) {
      navigator.geolocation?.clearWatch(webWatcherRef.current);
      webWatcherRef.current = null;
    }
  }, []);

  const onPositionUpdate = useCallback((lat: number, lng: number) => {
    setMyLocation({ lat, lng });
    if (backendGroupId) {
      locationUpdateMutation.mutate({ groupId: backendGroupId, lat, lng });
    }
  }, [backendGroupId]);

  const startWatcher = useCallback(async () => {
    if (Platform.OS === "web") {
      if (!("geolocation" in navigator)) return;
      const id = navigator.geolocation.watchPosition(
        (pos) => onPositionUpdate(pos.coords.latitude, pos.coords.longitude),
        (err) => setLocationError(err.message),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      webWatcherRef.current = id;
    } else {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== "granted") { setLocationError("Permission refusée"); return; }

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (pos) => onPositionUpdate(pos.coords.latitude, pos.coords.longitude)
      );
      watcherRef.current = sub;
    }
  }, [onPositionUpdate]);

  // Démarre/arrête le watcher selon l'état de partage
  useEffect(() => {
    if (sharing) {
      startWatcher();
    } else {
      stopWatcher();
    }
    return stopWatcher;
  }, [sharing]);

  // ===== POSITION INITIALE (une seule fois au montage) =====
  const requestLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      if (Platform.OS === "web") {
        if (!("geolocation" in navigator)) { setLocationError("Géolocalisation non disponible"); return; }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 })
        );
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermissionStatus("granted");
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        if (status !== "granted") { setLocationError("Permission refusée"); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (err: any) {
      if (err.code === 1) setLocationError("Permission refusée");
      else if (err.code === 2) setLocationError("Position non disponible");
      else if (err.code === 3) setLocationError("Délai dépassé");
      else setLocationError("Impossible d'obtenir la position");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  // ===== SSE : positions des autres membres =====
  const locationSseUrl = backendGroupId
    ? `${getApiBaseUrl()}/api/events/location/${backendGroupId}`
    : "";

  const { connected: sseConnected } = useSSE(locationSseUrl, !!backendGroupId, (data) => {
    if (data.type !== "location" || !data.payload) return;
    const { userId, name, lat, lng, updatedAt } = data.payload;
    setLiveLocations((prev) => {
      const next = new Map(prev);
      next.set(userId, { userId, name, lat, lng, updatedAt });
      return next;
    });
    dispatch({
      type: "UPDATE_LOCATION",
      payload: { groupId: groupId!, entry: { userId, name, lat, lng, updatedAt } },
    });
  });

  const handleToggleSharing = async () => {
    if (!sharing) await requestLocation();
    setSharing(!sharing);
    if (!sharing) {
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: {
          id: generateId(),
          type: "reminder",
          title: "Localisation activée",
          message: `Vous partagez votre position avec "${group?.name}"`,
          groupId: groupId!,
          read: false,
          createdAt: new Date().toISOString(),
        },
      });
    }
  };

  const COOLDOWN_SECONDS = 120;

  const startCooldown = () => {
    setSosCooldown(COOLDOWN_SECONDS);
    sosCooldownRef.current = setInterval(() => {
      setSosCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(sosCooldownRef.current!);
          sosCooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSOS = () => {
    if (sosCooldown > 0) return;

    if (!backendGroupId) {
      Alert.alert("Erreur", "Groupe non synchronisé avec le serveur. Veuillez patienter.");
      return;
    }

    Alert.alert(
      "🆘 Alerte SOS",
      "Tous les membres du groupe seront alertés avec votre position. Confirmer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "ENVOYER L'ALERTE",
          style: "destructive",
          onPress: () => {
            setSosActive(true);
            console.log("[SOS] mutation envoyée", { backendGroupId, lat: myLocation?.lat, lng: myLocation?.lng });

            sosMutation.mutate(
              { groupId: backendGroupId, lat: myLocation?.lat, lng: myLocation?.lng },
              {
                onSuccess: () => {
                  console.log("[SOS] succès");
                  Alert.alert("✅ Alerte envoyée", "Tous les membres ont été alertés.");
                  startCooldown();
                  setTimeout(() => setSosActive(false), 60000);
                },
                onError: (err) => {
                  console.error("[SOS] erreur mutation", err);
                  Alert.alert("❌ Erreur SOS", "L'alerte n'a pas pu être envoyée : " + err.message);
                  setSosActive(false);
                },
              }
            );
          },
        },
      ]
    );
  };

  // Format seconds as M:SS for the button label
  const formatCooldown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Nettoyage des timers au démontage
  useEffect(() => {
    return () => {
      if (sosCooldownRef.current) clearInterval(sosCooldownRef.current);
    };
  }, []);

  const baseLat = myLocation?.lat || 48.8566;
  const baseLng = myLocation?.lng || 2.3522;

  // Positions réelles depuis SSE — remplace les positions fictives
  const memberLocations: MemberLocation[] = (group?.members || []).map((m) => {
    const live = liveLocations.get(m.id);
    return {
      id: m.id,
      name: m.name,
      lat: live?.lat ?? baseLat,
      lng: live?.lng ?? baseLng,
      lastUpdate: live?.updatedAt ?? new Date().toISOString(),
      isSharing: !!live, // ne montre comme "en partage" que si données SSE réelles reçues
      initial: m.name.charAt(0),
    };
  });

  const centerOnMe = () => {
    if (mapRef.current && myLocation) {
      mapRef.current.animateToRegion(
        { latitude: myLocation.lat, longitude: myLocation.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    }
  };

  const renderMap = () => {
    if (!isMapAvailable) {
      return (
        <View
          style={{
            height: 320,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="location.fill" size={40} color={colors.muted} />
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>Carte non disponible</Text>
        </View>
      );
    }

    return (
      <View style={{ height: 320, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <PlatformMapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{ latitude: baseLat, longitude: baseLng, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
          showsUserLocation={sharing}
          showsMyLocationButton={false}
        >
          {sharing && myLocation && (
            <>
              <PlatformCircle
                center={{ latitude: myLocation.lat, longitude: myLocation.lng }}
                radius={50}
                fillColor={colors.primary + "20"}
                strokeColor={colors.primary + "60"}
                strokeWidth={1}
              />
              <PlatformMarker
                coordinate={{ latitude: myLocation.lat, longitude: myLocation.lng }}
                title="Ma position"
                pinColor={colors.primary}
              />
            </>
          )}
          {memberLocations
            .filter((m) => m.isSharing && m.id !== state.profile?.id)
            .map((m) => (
              <PlatformMarker
                key={m.id}
                coordinate={{ latitude: m.lat, longitude: m.lng }}
                title={m.name}
                description={`Mis à jour ${formatRelativeTime(m.lastUpdate)}`}
                pinColor={colors.success}
              />
            ))}
        </PlatformMapView>

        {/* Map overlay buttons */}
        <View style={{ position: "absolute", top: 12, right: 12, gap: 8, zIndex: 1000 }}>
          <Pressable
            onPress={centerOnMe}
            style={({ pressed }) => [
              {
                width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background,
                alignItems: "center", justifyContent: "center",
                shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="location.fill" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={requestLocation}
            style={({ pressed }) => [
              {
                width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background,
                alignItems: "center", justifyContent: "center",
                shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSymbol name="arrow.clockwise" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Status badge */}
        <View
          style={{
            position: "absolute", bottom: 12, left: 12,
            backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, zIndex: 1000,
          }}
        >
          {locationLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 10 }}>Localisation...</Text>
            </View>
          ) : myLocation ? (
            <Text style={{ color: "#FFF", fontSize: 10 }}>
              {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}
            </Text>
          ) : (
            <Text style={{ color: "#FF6B6B", fontSize: 10 }}>{locationError || "Non disponible"}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-2 pb-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Localisation</Text>
          {sharing && (
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sseConnected ? colors.success : colors.warning }} />
              <Text style={{ color: sseConnected ? colors.success : colors.warning, fontSize: 11, fontWeight: "600" }}>
                {sseConnected ? "LIVE" : "Reconnexion…"}
              </Text>
            </View>
          )}
        </View>

        {/* Real Map */}
        <View className="px-5 mb-4">{renderMap()}</View>

        {/* Permission Warning */}
        {permissionStatus && permissionStatus !== "granted" && (
          <View className="px-5 mb-4">
            <View
              style={{
                padding: 14, borderRadius: 14,
                backgroundColor: colors.warning + "10", borderWidth: 1, borderColor: colors.warning + "30",
              }}
            >
              <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 13 }}>
                Permission de localisation requise
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 }}>
                Autorisez l'accès à votre localisation dans les paramètres de votre navigateur ou appareil.
              </Text>
            </View>
          </View>
        )}

        {/* Share Location Toggle */}
        <View className="px-5 mb-4">
          <Pressable
            onPress={handleToggleSharing}
            style={({ pressed }) => [
              {
                flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16,
                backgroundColor: sharing ? colors.success + "15" : colors.surface,
                borderWidth: 2, borderColor: sharing ? colors.success : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: sharing ? colors.success + "25" : colors.border + "50",
                alignItems: "center", justifyContent: "center", marginRight: 12,
              }}
            >
              <IconSymbol name="location.fill" size={22} color={sharing ? colors.success : colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-foreground font-bold text-sm">
                {sharing ? "Partage actif" : "Partager ma position"}
              </Text>
              <Text className="text-muted text-xs mt-1">
                {sharing
                  ? "Vos amis voient votre position en temps réel (mise à jour toutes les 5s)"
                  : "Activez pour que vos amis vous localisent"}
              </Text>
            </View>
            <View
              style={{
                width: 48, height: 28, borderRadius: 14,
                backgroundColor: sharing ? colors.success : colors.border,
                justifyContent: "center", paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFF",
                  alignSelf: sharing ? "flex-end" : "flex-start",
                }}
              />
            </View>
          </Pressable>
        </View>

        {/* SOS Button */}
        <View className="px-5 mb-6">
          <Pressable
            onPress={handleSOS}
            disabled={sosCooldown > 0}
            style={({ pressed }) => [
              {
                backgroundColor: sosActive
                  ? colors.error
                  : sosCooldown > 0
                  ? colors.muted + "20"
                  : colors.error + "15",
                borderRadius: 16, padding: 18, alignItems: "center",
                borderWidth: 2,
                borderColor: sosCooldown > 0 ? colors.muted : colors.error,
              },
              pressed && sosCooldown === 0 && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol
                name="exclamationmark.triangle.fill"
                size={22}
                color={sosActive ? "#FFF" : sosCooldown > 0 ? colors.muted : colors.error}
              />
              <Text style={{
                color: sosActive ? "#FFF" : sosCooldown > 0 ? colors.muted : colors.error,
                fontWeight: "800", fontSize: 16,
              }}>
                {sosActive ? "ALERTE ENVOYÉE" : sosCooldown > 0 ? `SOS (${formatCooldown(sosCooldown)})` : "BOUTON SOS"}
              </Text>
            </View>
            <Text style={{
              color: sosActive ? "#FFFFFF80" : sosCooldown > 0 ? colors.muted : colors.error + "80",
              fontSize: 12, marginTop: 4,
            }}>
              {sosCooldown > 0
                ? "Veuillez patienter avant un nouvel envoi"
                : "Appuyez pour confirmer l'envoi à tous les membres"}
            </Text>
          </Pressable>
        </View>

        {/* Members */}
        <View className="px-5">
          <Text className="text-foreground font-bold mb-3">Membres</Text>
          {memberLocations.map((member) => (
            <View
              key={member.id}
              style={{
                flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12,
                marginBottom: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: member.isSharing ? colors.primary + "25" : colors.border + "50",
                  alignItems: "center", justifyContent: "center", marginRight: 10,
                }}
              >
                <Text style={{ fontWeight: "700", color: member.isSharing ? colors.primary : colors.muted, fontSize: 14 }}>
                  {member.initial}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-foreground font-semibold text-sm">{member.name}</Text>
                <Text className="text-muted text-xs mt-1">
                  {member.isSharing
                    ? `Mis à jour ${formatRelativeTime(member.lastUpdate)}`
                    : "Position non partagée"}
                </Text>
              </View>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: member.isSharing ? colors.success : colors.muted }} />
            </View>
          ))}
        </View>

        {/* Safety Tips */}
        <View className="px-5 mt-6">
          <Text className="text-foreground font-bold mb-3">Conseils de sécurité</Text>
          {[
            { icon: "car.fill" as const, text: "Vérifiez toujours la plaque du taxi/VTC" },
            { icon: "battery.100" as const, text: "Gardez votre téléphone chargé" },
            { icon: "drop.fill" as const, text: "Buvez de l'eau entre les verres" },
            { icon: "person.2.fill" as const, text: "Ne partez jamais seul(e)" },
          ].map((tip, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12,
                marginBottom: 6, backgroundColor: colors.warning + "08",
                borderWidth: 1, borderColor: colors.warning + "20",
              }}
            >
              <View
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: colors.warning + "15", alignItems: "center", justifyContent: "center", marginRight: 10,
                }}
              >
                <IconSymbol name={tip.icon} size={16} color={colors.warning} />
              </View>
              <Text className="text-foreground text-sm" style={{ flex: 1 }}>{tip.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

    </ScreenContainer>
  );
}

import { useState, useMemo, useEffect } from "react";
import { Text, View, Pressable, ScrollView, TextInput, Alert, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { trpc } from "@/lib/trpc";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";
import { useMutationWithToast } from "@/hooks/use-mutation-with-toast";

export default function CarpoolScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [showAdd, setShowAdd] = useState(false);
  const [departure, setDeparture] = useState("");
  const [seats, setSeats] = useState("3");
  const [departureTime, setDepartureTime] = useState("");
  const [loadingRideId, setLoadingRideId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await ridesQuery.refetch(); } finally { setRefreshing(false); }
  };

  const rides = state.carpoolRides.filter((r) => r.groupId === groupId);
  const userId = state.profile?.id || "user_1";

  const myCurrentRide = rides.find((r) => r.passengers.some((p) => p.id === userId));
  const myDriverRide = rides.find((r) => r.driverId === userId);

  // Get backend group ID
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  // Poll backend rides
  const ridesQuery = trpc.carpool.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );

  // SSE: refetch immediately on carpool changes
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "carpool") ridesQuery.refetch();
  });

  // externalId → backendId map
  const ridesBackendIds = useMemo(
    () => new Map((ridesQuery.data ?? []).map((r) => [r.externalId, r.id])),
    [ridesQuery.data]
  );

  // Sync backend → local state
  useEffect(() => {
    if (!ridesQuery.data || !groupId) return;
    const mapped = ridesQuery.data.map((r) => ({
      id: r.externalId,
      groupId: groupId!,
      driverId: r.driverId,
      driverName: (r as any).driverName ?? r.driverId,
      driverAvatar: "",
      departureLocation: r.departure ?? "",
      availableSeats: r.availableSeats ?? 0,
      totalSeats: r.totalSeats ?? r.availableSeats ?? 0,
      passengers: r.passengers ? JSON.parse(r.passengers) : [],
      departureTime: r.departureTime ?? new Date().toISOString(),
    }));
    dispatch({ type: "SET_GROUP_CARPOOL_RIDES", payload: { groupId: groupId!, rides: mapped } });
  }, [ridesQuery.data, groupId]);

  // Mutations
  const { isLoading: isActionLoading, buildOptions } = useMutationWithToast();
  const addRideMutation = trpc.carpool.add.useMutation(buildOptions());
  const deleteRideMutation = trpc.carpool.delete.useMutation(
    buildOptions({ onSuccess: () => ridesQuery.refetch() })
  );
  // join/leave utilisent mutateAsync + try/catch avec des messages métier spécifiques —
  // silent: true supprime le toast générique, le retry réseau reste actif.
  const joinMutation = trpc.carpool.join.useMutation(buildOptions({ silent: true }));
  const leaveMutation = trpc.carpool.leave.useMutation(buildOptions({ silent: true }));

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  };

  const handleAddRide = () => {
    if (!departure.trim()) return;
    const externalId = generateId();
    const totalSeats = parseInt(seats) || 3;
    dispatch({
      type: "ADD_CARPOOL_RIDE",
      payload: {
        id: externalId,
        groupId: groupId!,
        driverId: userId,
        driverName: state.profile?.name || "Moi",
        driverAvatar: "",
        departureLocation: departure.trim(),
        availableSeats: totalSeats - 1,
        totalSeats,
        passengers: [],
        departureTime: departureTime || new Date().toISOString(),
      },
    });
    if (backendGroupId) {
      addRideMutation.mutate({
        externalId,
        groupId: backendGroupId,
        driverId: userId,
        driverName: state.profile?.name || "Moi",
        departure: departure.trim(),
        departureTime: departureTime || new Date().toISOString(),
        totalSeats,
      });
    }
    setDeparture("");
    setSeats("3");
    setDepartureTime("");
    setShowAdd(false);
  };

  const handleDeleteRide = (rideId: string) => {
    const doDelete = () => {
      dispatch({ type: "DELETE_CARPOOL_RIDE", payload: rideId });
      const backendId = ridesBackendIds.get(rideId);
      if (backendId) deleteRideMutation.mutate({ id: backendId });
    };
    if (Platform.OS === "web") {
      if (confirm("Supprimer votre trajet ?")) doDelete();
    } else {
      Alert.alert("Supprimer le trajet", "Cette action est irréversible.", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const doLeave = async (rideId: string) => {
    setLoadingRideId(rideId);
    try {
      await leaveMutation.mutateAsync({ externalId: rideId });
      dispatch({ type: "LEAVE_CARPOOL", payload: { rideId, passengerId: userId } });
    } catch (e: any) {
      showAlert("Erreur", e.message || "Impossible de quitter ce trajet");
    } finally {
      setLoadingRideId(null);
    }
  };

  const doJoin = async (rideId: string) => {
    setLoadingRideId(rideId);
    try {
      await joinMutation.mutateAsync({
        externalId: rideId,
        passengerName: state.profile?.name || "Moi",
        passengerAvatar: "",
      });
      dispatch({
        type: "JOIN_CARPOOL",
        payload: { rideId, passenger: { id: userId, name: state.profile?.name || "Moi", avatar: "" } },
      });
    } catch (e: any) {
      showAlert(
        e.message === "Plus de places disponibles dans cette voiture" ? "Complet" : "Erreur",
        e.message || "Impossible de rejoindre ce trajet"
      );
    } finally {
      setLoadingRideId(null);
    }
  };

  const handleJoin = (rideId: string) => {
    if (loadingRideId) return;
    const ride = rides.find((r) => r.id === rideId);
    if (!ride) return;

    const imPassenger = ride.passengers.some((p) => p.id === userId);

    if (imPassenger) {
      doLeave(rideId);
      return;
    }

    if (ride.availableSeats <= 0) {
      showAlert("Complet", "Plus de places disponibles dans cette voiture.");
      return;
    }

    if (myCurrentRide) {
      const doSwitch = async () => {
        await doLeave(myCurrentRide.id);
        await doJoin(rideId);
      };
      if (Platform.OS === "web") {
        if (confirm(`Vous êtes déjà dans la voiture de ${myCurrentRide.driverName}. Voulez-vous changer ?`)) {
          doSwitch();
        }
      } else {
        Alert.alert(
          "Changer de voiture",
          `Vous êtes déjà dans la voiture de ${myCurrentRide.driverName}. Voulez-vous changer ?`,
          [
            { text: "Non", style: "cancel" },
            { text: "Changer", onPress: doSwitch },
          ]
        );
      }
      return;
    }

    doJoin(rideId);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Covoiturage</Text>
        </View>
        <Pressable
          onPress={() => setShowAdd(!showAdd)}
          style={({ pressed }) => [
            { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Je conduis</Text>
        </Pressable>
      </View>

      {/* Current ride info banner */}
      {myCurrentRide && (
        <View className="px-5 mb-3">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.primary + "10",
              borderWidth: 1,
              borderColor: colors.primary + "30",
              gap: 8,
            }}
          >
            <IconSymbol name="car.fill" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600", flex: 1 }}>
              Vous êtes dans la voiture de {myCurrentRide.driverName}
            </Text>
            <Pressable
              onPress={() => doLeave(myCurrentRide.id)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.error + "15",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: colors.error, fontSize: 11, fontWeight: "600" }}>Quitter</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Summary */}
      <View className="px-5 mb-4">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: "#3B82F6" + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#3B82F6" + "30", alignItems: "center" }}>
            <IconSymbol name="car.fill" size={24} color="#3B82F6" />
            <Text className="text-foreground text-xl font-bold mt-1">{rides.length}</Text>
            <Text className="text-muted text-xs">Voitures</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.success + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.success + "30", alignItems: "center" }}>
            <IconSymbol name="person.2.fill" size={24} color={colors.success} />
            <Text className="text-foreground text-xl font-bold mt-1">
              {rides.reduce((sum, r) => sum + r.availableSeats, 0)}
            </Text>
            <Text className="text-muted text-xs">Places dispo</Text>
          </View>
        </View>
      </View>

      {/* Add Ride Form */}
      {showAdd && (
        <View className="px-5 mb-4">
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.primary }}>
            <Text className="text-foreground font-semibold mb-2">Proposer un trajet</Text>
            <TextInput
              placeholder="Lieu de départ"
              placeholderTextColor={colors.muted}
              value={departure}
              onChangeText={setDeparture}
              style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
            />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text className="text-muted text-xs mb-1">Places</Text>
                <TextInput
                  placeholder="3"
                  placeholderTextColor={colors.muted}
                  value={seats}
                  onChangeText={setSeats}
                  keyboardType="numeric"
                  style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border, textAlign: "center" }}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text className="text-muted text-xs mb-1">Heure de départ</Text>
                <TextInput
                  placeholder="HH:MM"
                  placeholderTextColor={colors.muted}
                  value={departureTime}
                  onChangeText={setDepartureTime}
                  style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            </View>
            <Pressable
              onPress={handleAddRide}
              disabled={isActionLoading}
              style={({ pressed }) => [
                { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
                (pressed || isActionLoading) && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Proposer le trajet</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Rides List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
      >
        {rides.length === 0 ? (
          <View className="items-center py-12">
            <IconSymbol name="car.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-3 text-center">
              Aucun trajet proposé.{"\n"}Soyez le premier à conduire !
            </Text>
          </View>
        ) : (
          rides.map((ride) => {
            const isMyRide = ride.driverId === userId;
            const imPassenger = ride.passengers.some((p) => p.id === userId);
            const isInAnotherRide = myCurrentRide && myCurrentRide.id !== ride.id;
            return (
              <View
                key={ride.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: imPassenger ? 2 : 1,
                  borderColor: imPassenger ? colors.primary : colors.border,
                }}
              >
                {/* Driver */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#3B82F6" + "25",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <IconSymbol name="car.fill" size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text className="text-foreground font-bold text-sm">{ride.driverName}</Text>
                      <View style={{ backgroundColor: "#3B82F6" + "20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ color: "#3B82F6", fontSize: 9, fontWeight: "700" }}>CONDUCTEUR</Text>
                      </View>
                    </View>
                    <Text className="text-muted text-xs mt-1">📍 {ride.departureLocation}</Text>
                  </View>
                </View>

                {/* Seats visual */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 4 }}>
                  {Array.from({ length: ride.totalSeats }).map((_, i) => {
                    const occupied = i < ride.totalSeats - ride.availableSeats;
                    const passengerName = occupied && ride.passengers[i] ? ride.passengers[i].name : null;
                    return (
                      <View key={i} style={{ alignItems: "center" }}>
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: occupied ? colors.primary + "25" : colors.border + "50",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <IconSymbol
                            name="person.fill"
                            size={14}
                            color={occupied ? colors.primary : colors.muted}
                          />
                        </View>
                        {passengerName && (
                          <Text style={{ color: colors.muted, fontSize: 8, marginTop: 2 }} numberOfLines={1}>
                            {passengerName.split(" ")[0]}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                  <Text className="text-muted text-xs ml-2">
                    {ride.availableSeats} place{ride.availableSeats !== 1 ? "s" : ""} dispo
                  </Text>
                </View>

                {/* Passengers list */}
                {ride.passengers.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text className="text-muted text-xs mb-2">Passagers :</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {ride.passengers.map((p) => (
                        <View
                          key={p.id}
                          style={{
                            backgroundColor: p.id === userId ? colors.primary + "25" : colors.primary + "10",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 8,
                            borderWidth: p.id === userId ? 1 : 0,
                            borderColor: colors.primary,
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                            {p.name} {p.id === userId ? "(vous)" : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action */}
                {!isMyRide && (() => {
                  const isLoading = loadingRideId === ride.id;
                  const bgColor = imPassenger ? colors.error + "15" : isInAnotherRide ? colors.warning + "15" : colors.primary;
                  const borderColor = imPassenger ? colors.error : colors.warning;
                  return (
                    <Pressable
                      onPress={() => handleJoin(ride.id)}
                      disabled={isLoading || !!loadingRideId}
                      style={({ pressed }) => [
                        {
                          backgroundColor: bgColor,
                          borderRadius: 10,
                          padding: 12,
                          alignItems: "center",
                          borderWidth: imPassenger || isInAnotherRide ? 1 : 0,
                          borderColor,
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 6,
                          opacity: isLoading || !!loadingRideId ? 0.6 : 1,
                        },
                        pressed && !isLoading && { opacity: 0.7 },
                      ]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={imPassenger ? colors.error : isInAnotherRide ? colors.warning : "#FFF"} />
                      ) : imPassenger ? (
                        <>
                          <IconSymbol name="xmark.circle.fill" size={16} color={colors.error} />
                          <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Me retirer</Text>
                        </>
                      ) : isInAnotherRide ? (
                        <>
                          <IconSymbol name="arrow.right.arrow.left" size={16} color={colors.warning} />
                          <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 14 }}>Changer de voiture</Text>
                        </>
                      ) : (
                        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 14 }}>Réserver une place</Text>
                      )}
                    </Pressable>
                  );
                })()}
                {isMyRide && (
                  <Pressable
                    onPress={() => handleDeleteRide(ride.id)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.error + "15",
                        borderRadius: 10,
                        padding: 12,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: colors.error,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>Supprimer mon trajet</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

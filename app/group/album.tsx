import { useState, useMemo, useEffect } from "react";
import { Text, View, Pressable, ScrollView, Dimensions, Platform, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp, generateId } from "@/lib/app-provider";
import { formatDate } from "@/lib/helpers";
import { trpc } from "@/lib/trpc";
import { useGroupRefreshSSE } from "@/hooks/use-group-sse";
import { getApiBaseUrl } from "@/constants/oauth";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - 48) / 3;

export default function AlbumScreen() {
  const { state, dispatch } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const photos = state.photos.filter((p) => p.groupId === groupId);

  // Get backend group ID
  const backendGroupQuery = trpc.groups.get.useQuery(
    { externalId: groupId! },
    { enabled: !!groupId, staleTime: Infinity }
  );
  const backendGroupId = backendGroupQuery.data?.id ?? null;

  // Poll backend photos
  const photosQuery = trpc.photos.list.useQuery(
    { groupId: backendGroupId! },
    { enabled: !!backendGroupId, refetchInterval: 5000 }
  );

  // SSE: refetch immediately when someone uploads a photo
  useGroupRefreshSSE(backendGroupId, (module) => {
    if (module === "photos") photosQuery.refetch();
  });

  // externalId → backendId map
  const photosBackendIds = useMemo(
    () => new Map((photosQuery.data ?? []).map((p) => [p.externalId, p.id])),
    [photosQuery.data]
  );

  // Sync backend → local state
  useEffect(() => {
    if (!photosQuery.data || !groupId) return;
    const mapped = photosQuery.data.map((p) => ({
      id: p.externalId,
      groupId: groupId!,
      uri: p.uri,
      uploadedBy: p.uploadedBy ?? "",
      uploadedByName: (p as any).uploadedByName ?? "Inconnu",
      tags: [],
      createdAt: p.createdAt.toString(),
    }));
    dispatch({ type: "SET_GROUP_PHOTOS", payload: { groupId: groupId!, photos: mapped } });
  }, [photosQuery.data, groupId]);

  // Mutations
  const addPhotoMutation = trpc.photos.add.useMutation();
  const deletePhotoMutation = trpc.photos.delete.useMutation({ onSuccess: () => photosQuery.refetch() });

  /** Upload le fichier local vers le serveur et retourne l'URL publique. */
  const uploadToServer = async (localUri: string): Promise<string> => {
    const filename = localUri.split("/").pop() || "photo.jpg";
    const formData = new FormData();
    formData.append("file", { uri: localUri, name: filename, type: "image/jpeg" } as any);
    const response = await fetch(`${getApiBaseUrl()}/api/upload/photo`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload échoué : ${response.status}`);
    const data = await response.json();
    return data.url as string;
  };

  const addPhoto = async (localUri: string) => {
    const externalId = generateId();
    // Affichage optimiste avec l'URI locale en attendant l'upload
    dispatch({
      type: "ADD_PHOTO",
      payload: {
        id: externalId,
        groupId: groupId!,
        uri: localUri,
        uploadedBy: state.profile?.id || "user_1",
        uploadedByName: state.profile?.name || "Moi",
        tags: [],
        createdAt: new Date().toISOString(),
      },
    });
    if (!backendGroupId) return;
    setUploading(true);
    try {
      let finalUri = localUri;
      // Sur mobile, uploader vers le serveur pour que les autres voient la photo
      if (Platform.OS !== "web") {
        finalUri = await uploadToServer(localUri);
        // Mettre à jour l'URI optimiste avec l'URL serveur
        dispatch({ type: "UPDATE_PHOTO_URI", payload: { id: externalId, uri: finalUri } });
      }
      addPhotoMutation.mutate({
        externalId,
        groupId: backendGroupId,
        uri: finalUri,
        uploadedBy: state.profile?.id || "user_1",
        uploadedByName: state.profile?.name || "Moi",
      });
    } catch (e) {
      console.warn("[Album] upload échoué", e);
      // Fallback : stocker l'URI locale (visible uniquement localement)
      addPhotoMutation.mutate({
        externalId,
        groupId: backendGroupId,
        uri: localUri,
        uploadedBy: state.profile?.id || "user_1",
        uploadedByName: state.profile?.name || "Moi",
      });
    } finally {
      setUploading(false);
    }
  };

  /** Télécharge une photo dans l'album photo du téléphone. */
  const handleDownloadPhoto = async (photo: { id: string; uri: string; uploadedByName: string }) => {
    if (Platform.OS === "web") {
      const a = document.createElement("a");
      a.href = photo.uri;
      a.download = `ravvy-${photo.id}.jpg`;
      a.click();
      return;
    }
    setDownloadingId(photo.id);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez l'accès à la galerie dans les paramètres.");
        return;
      }
      const filename = `ravvy-${photo.id}.jpg`;
      const file = new File(Paths.cache, filename);
      await File.downloadFileAsync(photo.uri, file);
      const asset = await MediaLibrary.createAssetAsync(file.uri);
      const group = state.groups.find((g) => g.id === groupId);
      await MediaLibrary.createAlbumAsync(`Ravvy - ${group?.name || "Album"}`, asset, false);
      Alert.alert("Photo sauvegardée", "La photo a été ajoutée à votre galerie.");
    } catch (e) {
      console.warn("[Album] téléchargement échoué", e);
      Alert.alert("Erreur", "Impossible de sauvegarder la photo.");
    } finally {
      setDownloadingId(null);
    }
  };

  /** Télécharge toutes les photos du groupe. */
  const handleDownloadAll = async () => {
    if (photos.length === 0) return;
    for (const photo of photos) {
      if (isRealImage(photo.uri)) await handleDownloadPhoto(photo);
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        for (const asset of result.assets) await addPhoto(asset.uri);
      }
    } catch (e) {
      console.warn("ImagePicker error:", e);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        const msg = "Permission caméra nécessaire pour prendre une photo";
        if (Platform.OS === "web") alert(msg);
        else Alert.alert("Permission refusée", msg);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        await addPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Camera error:", e);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    dispatch({ type: "DELETE_PHOTO", payload: photoId });
    setSelectedPhoto(null);
    const backendId = photosBackendIds.get(photoId);
    if (backendId) {
      deletePhotoMutation.mutate({ id: backendId });
    }
  };

  const selectedPhotoData = photos.find((p) => p.id === selectedPhoto);
  const isRealImage = (uri: string) => !uri.startsWith("#");

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-xl font-bold">Album Photo</Text>
          {uploading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          {photos.length > 0 && (
            <Pressable
              onPress={handleDownloadAll}
              style={({ pressed }) => [
                { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="arrow.down.circle.fill" size={14} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Tout</Text>
            </Pressable>
          )}
        <Pressable
          onPress={() => setShowAddMenu(!showAddMenu)}
          style={({ pressed }) => [
            { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconSymbol name="plus" size={14} color="#FFF" />
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Ajouter</Text>
        </Pressable>
        </View>
      </View>

      {/* Add Menu */}
      {showAddMenu && (
        <View className="px-5 mb-3">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => { setShowAddMenu(false); handlePickFromLibrary(); }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primary + "15",
                  borderWidth: 1,
                  borderColor: colors.primary + "30",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="photo.fill" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Galerie</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowAddMenu(false); handleTakePhoto(); }}
              style={({ pressed }) => [
                {
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "#F59E0B" + "15",
                  borderWidth: 1,
                  borderColor: "#F59E0B" + "30",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <IconSymbol name="camera.fill" size={16} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontWeight: "600", fontSize: 13 }}>Caméra</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Stats */}
      <View className="px-5 mb-4">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: "#EC4899" + "15", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#EC4899" + "30", alignItems: "center" }}>
            <Text className="text-foreground text-xl font-bold">{photos.length}</Text>
            <Text className="text-muted text-xs">Photos</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
            <Text className="text-foreground text-xl font-bold">
              {new Set(photos.map((p) => p.uploadedBy)).size}
            </Text>
            <Text className="text-muted text-xs">Contributeurs</Text>
          </View>
        </View>
      </View>

      {/* Photo Grid */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {photos.length === 0 ? (
          <View className="items-center py-12">
            <IconSymbol name="photo.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-3 text-center">
              Aucune photo pour le moment.{"\n"}Ajoutez des souvenirs !
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => setSelectedPhoto(photo.id)}
                style={({ pressed }) => [
                  {
                    width: PHOTO_SIZE,
                    height: PHOTO_SIZE,
                    borderRadius: 10,
                    backgroundColor: isRealImage(photo.uri) ? colors.surface : photo.uri,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {isRealImage(photo.uri) ? (
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                    contentFit="cover"
                  />
                ) : (
                  <>
                    <IconSymbol name="photo.fill" size={24} color="#FFFFFF80" />
                    <Text style={{ color: "#FFFFFF80", fontSize: 10, marginTop: 4 }}>
                      {photo.uploadedByName}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Photo Detail Modal */}
      {selectedPhotoData && (
        <Pressable
          onPress={() => setSelectedPhoto(null)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          {isRealImage(selectedPhotoData.uri) ? (
            <Image
              source={{ uri: selectedPhotoData.uri }}
              style={{
                width: width - 40,
                height: width - 40,
                borderRadius: 16,
                marginBottom: 16,
              }}
              contentFit="contain"
            />
          ) : (
            <View
              style={{
                width: width - 40,
                height: width - 40,
                borderRadius: 16,
                backgroundColor: selectedPhotoData.uri,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconSymbol name="photo.fill" size={48} color="#FFFFFF80" />
            </View>
          )}
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>
            Par {selectedPhotoData.uploadedByName}
          </Text>
          <Text style={{ color: "#FFFFFF80", fontSize: 13, marginTop: 4 }}>
            {formatDate(selectedPhotoData.createdAt)}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            {isRealImage(selectedPhotoData.uri) && (
              <Pressable
                onPress={() => handleDownloadPhoto(selectedPhotoData)}
                disabled={downloadingId === selectedPhotoData.id}
                style={({ pressed }) => [
                  { backgroundColor: "#3B82F630", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {downloadingId === selectedPhotoData.id
                  ? <ActivityIndicator size="small" color="#3B82F6" />
                  : <IconSymbol name="arrow.down.circle.fill" size={16} color="#3B82F6" />}
                <Text style={{ color: "#3B82F6", fontWeight: "600" }}>Télécharger</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => handleDeletePhoto(selectedPhotoData.id)}
              style={({ pressed }) => [
                { backgroundColor: "#EF444430", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#EF4444", fontWeight: "600" }}>Supprimer</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedPhoto(null)}
              style={({ pressed }) => [
                { backgroundColor: "#FFFFFF20", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Fermer</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </ScreenContainer>
  );
}

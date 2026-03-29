import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { AppState, UserProfile, defaultState } from "./types";

// ===== STORAGE KEYS =====
const STORAGE_KEY = "@ravvy_state";
// Profile stored separately in SecureStore (chiffré) pour protéger les données personnelles
const SECURE_PROFILE_KEY = "ravvy_profile";

// ===== SECURE PROFILE HELPERS =====
async function loadSecureProfile(): Promise<UserProfile | null> {
  try {
    const raw = Platform.OS === "web"
      ? localStorage.getItem(SECURE_PROFILE_KEY)
      : await SecureStore.getItemAsync(SECURE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveSecureProfile(profile: UserProfile | null): Promise<void> {
  try {
    if (profile) {
      const raw = JSON.stringify(profile);
      if (Platform.OS === "web") {
        localStorage.setItem(SECURE_PROFILE_KEY, raw);
      } else {
        await SecureStore.setItemAsync(SECURE_PROFILE_KEY, raw);
      }
    } else {
      if (Platform.OS === "web") {
        localStorage.removeItem(SECURE_PROFILE_KEY);
      } else {
        await SecureStore.deleteItemAsync(SECURE_PROFILE_KEY).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("Failed to save secure profile:", e);
  }
}

// ===== PERSISTENCE =====
export async function loadState(): Promise<AppState> {
  try {
    const [raw, secureProfile] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      loadSecureProfile(),
    ]);

    const { profile: legacyProfile, ...rest } = raw
      ? { ...defaultState, ...JSON.parse(raw) }
      : defaultState;

    // Priorité : SecureStore > migration depuis AsyncStorage (1ère fois après màj)
    const profile = secureProfile ?? legacyProfile ?? null;

    return { ...rest, profile };
  } catch (e) {
    console.warn("Failed to load state:", e);
    return defaultState;
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (Platform.OS === "web") {
      localStorage.removeItem(SECURE_PROFILE_KEY);
    } else {
      await SecureStore.deleteItemAsync(SECURE_PROFILE_KEY).catch(() => {});
    }
  } catch (e) {
    console.warn("Failed to clear state:", e);
  }
}

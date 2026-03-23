import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web platform uses cookie-based auth, no manual token management needed
    if (Platform.OS === "web") {
      return null;
    }
    // SecureStore peut échouer quand l'app est en arrière-plan ou pas encore interactive
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    console.warn("[Auth] SecureStore.getItemAsync(SESSION_TOKEN_KEY) failed, falling back to null:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch (error) {
    console.warn("[Auth] SecureStore.setItemAsync(SESSION_TOKEN_KEY) failed:", error);
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch (error) {
    console.warn("[Auth] SecureStore.deleteItemAsync(SESSION_TOKEN_KEY) failed:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    if (Platform.OS === "web") {
      const info = window.localStorage.getItem(USER_INFO_KEY);
      return info ? JSON.parse(info) : null;
    }
    // SecureStore peut échouer quand l'app est en arrière-plan ou pas encore interactive
    const info = await SecureStore.getItemAsync(USER_INFO_KEY);
    return info ? JSON.parse(info) : null;
  } catch (error) {
    console.warn("[Auth] SecureStore.getItemAsync(USER_INFO_KEY) failed, falling back to null:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn("[Auth] SecureStore.setItemAsync(USER_INFO_KEY) failed:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.warn("[Auth] SecureStore.deleteItemAsync(USER_INFO_KEY) failed:", error);
  }
}

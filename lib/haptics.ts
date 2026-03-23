import { Platform } from "react-native";

let Haptics: typeof import("expo-haptics") | null = null;
if (Platform.OS !== "web") {
  try {
    Haptics = require("expo-haptics");
  } catch {}
}

export function hapticLight() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium() {
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticSuccess() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError() {
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

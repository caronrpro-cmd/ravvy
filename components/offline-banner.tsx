import { useEffect, useRef } from "react";
import { Animated, Platform, Text } from "react-native";

type Props = {
  isOffline: boolean;
  pendingCount: number;
};

/**
 * Slides in from the top when the device is offline or there are pending
 * queued mutations waiting to be replayed.
 */
export function OfflineBanner({ isOffline, pendingCount }: Props) {
  const visible = isOffline || pendingCount > 0;
  const translateY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const message =
    isOffline || pendingCount === 0
      ? "Mode hors-ligne — les changements seront synchronisés"
      : `Synchronisation en cours… (${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente)`;

  // On web, avoid occupying layout space when hidden
  if (Platform.OS === "web" && !visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "#F59E0B",
        paddingVertical: 8,
        paddingHorizontal: 16,
        transform: [{ translateY }],
      }}
    >
      <Text
        style={{ color: "#fff", fontSize: 13, textAlign: "center", fontWeight: "600" }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

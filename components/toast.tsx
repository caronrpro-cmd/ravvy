import { useEffect, useRef } from "react";
import { Animated, Text, View, Platform } from "react-native";

export type ToastVariant = "success" | "error" | "info";

type Props = {
  message: string;
  variant: ToastVariant;
  visible: boolean;
};

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: "#10B981", icon: "✓" },
  error:   { bg: "#EF4444", icon: "✕" },
  info:    { bg: "#3B82F6", icon: "ℹ" },
};

/**
 * Animated toast banner that slides in from the top and auto-dismisses.
 * Rendered by ToastProvider — do not use directly, call useToast() instead.
 */
export function Toast({ message, variant, visible }: Props) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  const { bg, icon } = VARIANT_STYLES[variant];

  // On web, hide from layout when invisible
  if (Platform.OS === "web" && !visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: Platform.OS === "ios" ? 56 : 40,
        left: 16,
        right: 16,
        zIndex: 10000,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.25)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>{icon}</Text>
        </View>
        <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600", flex: 1, lineHeight: 20 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

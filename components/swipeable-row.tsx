import { useRef } from "react";
import { Animated, View, Pressable, Platform } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableRow({ children, onDelete }: SwipeableRowProps) {
  const colors = useColors();
  const swipeableRef = useRef<Swipeable>(null);

  // On web, gesture handler swipeables don't work well — render plain
  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });
    return (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        style={{
          backgroundColor: colors.error,
          justifyContent: "center",
          alignItems: "center",
          width: 72,
          borderRadius: 12,
          marginLeft: 6,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <IconSymbol name="trash.fill" size={20} color="#FFF" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

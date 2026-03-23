import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBox({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.border },
        { opacity },
        style,
      ]}
    />
  );
}

export function MessageSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {[false, true, false, true, false].map((isRight, i) => (
        <View
          key={i}
          style={{ flexDirection: "row", justifyContent: isRight ? "flex-end" : "flex-start", gap: 8 }}
        >
          {!isRight && <SkeletonBox width={28} height={28} borderRadius={14} />}
          <View style={{ gap: 4, maxWidth: "65%" }}>
            <SkeletonBox width={i % 2 === 0 ? 180 : 120} height={38} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function GroupCardSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: 20 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <SkeletonBox width={50} height={50} borderRadius={14} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="70%" height={14} />
            <SkeletonBox width="45%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ListItemSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8, paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12 }}>
          <SkeletonBox width={40} height={40} borderRadius={10} />
          <View style={{ flex: 1, gap: 5 }}>
            <SkeletonBox width={`${60 + (i % 3) * 10}%`} height={13} />
            <SkeletonBox width="35%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

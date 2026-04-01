import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { style, children, accessibilityRole, accessibilityState, onPress, onPressIn, onLongPress, testID, ...rest } = props;
  return (
    <Pressable
      style={style}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      onPressIn={(ev) => {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev as any);
      }}
    >
      {children}
    </Pressable>
  );
}

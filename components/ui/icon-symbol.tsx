import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Tab bar icons
  "house.fill": "home",
  "person.3.fill": "groups",
  "plus.circle.fill": "add-circle",
  "bell.fill": "notifications",
  "person.fill": "person",
  // Navigation & actions
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "paperplane.fill": "send",
  "xmark": "close",
  "plus": "add",
  "minus": "remove",
  // Group & social
  "person.2.fill": "people",
  "person.badge.plus": "person-add",
  "qrcode": "qr-code",
  "star.fill": "star",
  "crown.fill": "workspace-premium",
  // Modules
  "bubble.left.fill": "chat",
  "cart.fill": "shopping-cart",
  "car.fill": "directions-car",
  "photo.fill": "photo-library",
  "checkmark.circle.fill": "check-circle",
  "location.fill": "location-on",
  "exclamationmark.triangle.fill": "warning",
  "sos.circle.fill": "emergency",
  // Status & RSVP
  "checkmark": "check",
  "xmark.circle.fill": "cancel",
  "questionmark.circle.fill": "help",
  // Settings & profile
  "gear": "settings",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "lock.fill": "lock",
  "trash.fill": "delete",
  "pencil": "edit",
  "camera.fill": "camera-alt",
  "photo.on.rectangle": "image",
  // Misc
  "clock.fill": "schedule",
  "pin.fill": "push-pin",
  "heart.fill": "favorite",
  "flag.fill": "flag",
  "magnifyingglass": "search",
  "arrow.down.circle.fill": "download",
  "square.and.arrow.up": "share",
  "brain.head.profile": "psychology",
  "sparkles": "auto-awesome",
  "dollarsign.circle.fill": "attach-money",
  "list.bullet": "list",
  "map.fill": "map",
  "timer": "timer",
  // Additional icons used in the app
  "arrow.right": "arrow-forward",
  "arrow.clockwise": "refresh",
  "arrow.counterclockwise": "refresh",
  "arrow.right.arrow.left": "swap-horiz",
  "arrow.right.square": "exit-to-app",
  "calendar": "calendar-today",
  "chart.bar.fill": "bar-chart",
  "doc.text": "description",
  "doc.on.doc": "file-copy",
  "doc.on.doc.fill": "file-copy",
  "hand.raised.fill": "back-hand",
  "info.circle.fill": "info",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

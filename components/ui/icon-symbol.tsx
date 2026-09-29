import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { type ColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "doc.text.fill": "description",
  "plus.circle.fill": "add-circle",
  "location.fill": "location-on",
  "camera.fill": "photo-camera",
  "checkmark.seal.fill": "verified",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "square.and.arrow.up": "ios-share",
  "pencil": "edit",
  "trash": "delete-outline",
  "info.circle.fill": "info-outline",
  "person.fill": "person",
  "building.2.fill": "business",
  "map.fill": "map",
  "photo.fill": "photo-library",
  "ellipsis.circle": "more-horiz",
  "clipboard.fill": "assignment",
  "calendar": "event",
  "arrow.clockwise": "refresh",
  "chart.bar.fill": "bar-chart",
  "arrow.triangle.2.circlepath": "sync-alt",
  "person.2.fill": "people",
  "shield.fill": "security",
  "folder.fill": "folder",
  "magnifyingglass": "search",
} satisfies IconMapping;

export function IconSymbol({ name, size = 24, color, style }: { name: IconSymbolName; size?: number; color: ColorValue; style?: StyleProp<TextStyle>; weight?: SymbolWeight }) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

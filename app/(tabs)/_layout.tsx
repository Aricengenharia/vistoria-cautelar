import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: 56 + bottomPadding, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inspeções", tabBarIcon: ({ color }) => <IconSymbol name="clipboard.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: "Base técnica", tabBarIcon: ({ color }) => <IconSymbol name="doc.text.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ title: "Painel", tabBarIcon: ({ color }) => <IconSymbol name="chart.bar.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="workflow" options={{ title: "Status", tabBarIcon: ({ color }) => <IconSymbol name="arrow.triangle.2.circlepath" size={23} color={color} /> }} />
      <Tabs.Screen name="gallery" options={{ title: "Galeria", tabBarIcon: ({ color }) => <IconSymbol name="photo.fill" size={23} color={color} /> }} />
    </Tabs>
  );
}

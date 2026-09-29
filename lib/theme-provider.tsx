import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import type { ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = (useSystemColorScheme() === "dark" ? "dark" : "light") as ColorScheme;
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    Appearance.setColorScheme?.(scheme);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = colorScheme;
      document.documentElement.style.backgroundColor = colorScheme === "dark" ? "#111714" : "#F7F8F4";
    }
  }, [colorScheme]);

  const value = useMemo(() => ({ colorScheme, setColorScheme }), [colorScheme, setColorScheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}

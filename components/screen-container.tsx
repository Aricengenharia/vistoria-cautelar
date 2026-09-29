import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  className: _className,
  containerClassName: _containerClassName,
  safeAreaClassName: _safeAreaClassName,
  ...props
}: ScreenContainerProps) {
  return (
    <View style={styles.outer} {...props}>
      <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#F7F8F4" },
  safeArea: { flex: 1, backgroundColor: "#F7F8F4" },
  content: { flex: 1 },
});

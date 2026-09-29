import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <View style={styles.sectionTitle}><View style={styles.titleRule} /><View style={styles.titleCopy}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View></View>;
}

export function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9BA59F" multiline={multiline} keyboardType={keyboardType} style={[styles.input, multiline && styles.multiline]} {...props} /></View>;
}

export function ChoiceChip({ label, selected, onPress, color = "#2E7D62" }: { label: string; selected?: boolean; onPress: () => void; color?: string }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && { backgroundColor: color, borderColor: color }, pressed && { opacity: 0.72 }]}><Text style={[styles.chipText, selected && { color: "#FFFFFF" }]}>{label}</Text></Pressable>;
}

export function PrimaryButton({ label, onPress, icon = "chevron.right", variant = "primary", disabled = false }: { label: string; onPress: () => void; icon?: any; variant?: "primary" | "outline" | "soft"; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, variant === "outline" && styles.outlineButton, variant === "soft" && styles.softButton, disabled && styles.disabled, pressed && { transform: [{ scale: 0.98 }] }]}><Text style={[styles.buttonText, variant !== "primary" && styles.outlineButtonText]}>{label}</Text><IconSymbol name={icon} size={18} color={variant === "primary" ? "#FFFFFF" : "#2E7D62"} /></Pressable>;
}

export function IconButton({ icon, onPress, label, color = "#2E7D62" }: { icon: any; onPress: () => void; label?: string; color?: string }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { borderColor: `${color}25` }, pressed && { opacity: 0.68 }]}><IconSymbol name={icon} size={20} color={color} /></Pressable>;
}

export function StatusPill({ label, color = "#2E7D62" }: { label: string; color?: string }) {
  return <View style={[styles.statusPill, { backgroundColor: `${color}16` }]}><View style={[styles.statusDot, { backgroundColor: color }]} /><Text style={[styles.statusText, { color }]}>{label}</Text></View>;
}

export function StatCard({ value, label, icon, color }: { value: string; label: string; icon: any; color: string }) {
  return <View style={styles.statCard}><View style={[styles.statIcon, { backgroundColor: `${color}14` }]}><IconSymbol name={icon} size={18} color={color} /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><IconSymbol name="clipboard.fill" size={26} color="#2E7D62" /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDescription}>{description}</Text>{action}</View>;
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: "row", gap: 12, marginBottom: 16 },
  titleRule: { width: 4, borderRadius: 4, backgroundColor: "#2E7D62", minHeight: 42 },
  titleCopy: { flex: 1 },
  eyebrow: { color: "#2E7D62", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 3 },
  title: { color: "#1D2924", fontSize: 21, lineHeight: 27, fontWeight: "800" },
  detail: { color: "#738078", fontSize: 13, lineHeight: 19, marginTop: 4 },
  field: { marginBottom: 14 },
  label: { color: "#56625B", fontSize: 12, fontWeight: "700", marginBottom: 7 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#E1E7E2", borderWidth: 1, borderRadius: 12, color: "#1D2924", fontSize: 15, minHeight: 46, paddingHorizontal: 14, paddingVertical: 11 },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  chip: { borderWidth: 1, borderColor: "#DCE5DE", backgroundColor: "#FFFFFF", borderRadius: 100, paddingHorizontal: 13, paddingVertical: 9, marginRight: 8, marginBottom: 8 },
  chipText: { color: "#526159", fontSize: 12, fontWeight: "700" },
  button: { minHeight: 50, backgroundColor: "#2E7D62", borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  outlineButton: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#B9D7C8" },
  softButton: { backgroundColor: "#E7F2EC" },
  outlineButtonText: { color: "#2E7D62" },
  disabled: { opacity: 0.45 },
  iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#F3F8F4", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "800" },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 15, padding: 13, minHeight: 112 },
  statIcon: { width: 31, height: 31, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { color: "#1D2924", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#738078", fontSize: 11, fontWeight: "600", marginTop: 2 },
  empty: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 22, padding: 26, alignItems: "center", marginTop: 16 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: "#E7F2EC", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: "#1D2924", fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDescription: { color: "#738078", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, marginBottom: 16 },
});

export const uiStyles = styles;

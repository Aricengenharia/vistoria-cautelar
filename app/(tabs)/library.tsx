import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SectionTitle } from "@/components/inspection-ui";
import { REPORT_SECTIONS, getReportDisclaimer } from "@/lib/inspection-storage";

export default function LibraryScreen() {
  return <ScreenContainer style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.overline}>BASE TÉCNICA</Text><Text style={styles.title}>Modelo de relatório</Text><Text style={styles.subtitle}>Estrutura digital baseada no documento de vistoria cautelar fornecido.</Text>
      <View style={styles.cover}><View style={styles.coverTop}><Text style={styles.coverCode}>VC · MODELO 01</Text><IconSymbol name="doc.text.fill" size={25} color="#B7D9C5" /></View><Text style={styles.coverTitle}>Relatório técnico</Text><Text style={styles.coverSubtitle}>Vistoria cautelar</Text><View style={styles.coverLine} /><Text style={styles.coverSmall}>Coleta em campo com evidências e georreferenciamento.</Text></View>
      <SectionTitle eyebrow="estrutura" title="Seções incorporadas" detail="O formulário conduz a coleta na mesma lógica do modelo técnico." />
      <View style={styles.sectionList}>{REPORT_SECTIONS.map((section, index) => <View key={section} style={styles.sectionRow}><View style={styles.number}><Text style={styles.numberText}>{String(index + 1).padStart(2, "0")}</Text></View><Text style={styles.sectionText}>{section}</Text><IconSymbol name="checkmark.seal.fill" size={17} color="#B6C7BC" /></View>)}</View>
      <View style={styles.tip}><IconSymbol name="info.circle.fill" size={19} color="#2E7D62" /><View style={styles.tipCopy}><Text style={styles.tipTitle}>Como usar no campo</Text><Text style={styles.tipText}>Preencha o endereço, capture o GPS no local, fotografe as condições observadas e registre as informações do acompanhante. O rascunho pode ser salvo a qualquer momento.</Text></View></View>
      <View style={styles.disclaimer}><Text style={styles.disclaimerTitle}>Nota técnica</Text><Text style={styles.disclaimerText}>{getReportDisclaimer()}</Text></View>
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F8F4" },
  content: { padding: 20, paddingBottom: 36 },
  overline: { color: "#2E7D62", fontSize: 10, letterSpacing: 1.4, fontWeight: "800", marginTop: 7, marginBottom: 8 },
  title: { color: "#1D2924", fontSize: 30, letterSpacing: -0.6, fontWeight: "800" },
  subtitle: { color: "#738078", fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  cover: { backgroundColor: "#203C31", borderRadius: 22, padding: 20, marginBottom: 27 },
  coverTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coverCode: { color: "#A9D4BE", fontSize: 10, letterSpacing: 1.2, fontWeight: "800" },
  coverTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", marginTop: 28 },
  coverSubtitle: { color: "#D1E3D9", fontSize: 18, marginTop: 3 },
  coverLine: { height: 1, backgroundColor: "#446052", marginVertical: 20 },
  coverSmall: { color: "#B9D0C4", fontSize: 12, lineHeight: 18 },
  sectionList: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 17, padding: 6, marginBottom: 16 },
  sectionRow: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: "#EFF3F0" },
  number: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#E7F2EC", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#2E7D62", fontSize: 10, fontWeight: "800" },
  sectionText: { color: "#314139", fontSize: 13, flex: 1 },
  tip: { flexDirection: "row", gap: 10, backgroundColor: "#E7F2EC", borderRadius: 16, padding: 15, marginBottom: 12 },
  tipCopy: { flex: 1 },
  tipTitle: { color: "#2E7D62", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  tipText: { color: "#527466", fontSize: 12, lineHeight: 18 },
  disclaimer: { borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, backgroundColor: "#FFFFFF", padding: 15 },
  disclaimerTitle: { color: "#56625B", fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  disclaimerText: { color: "#738078", fontSize: 11, lineHeight: 17 },
});

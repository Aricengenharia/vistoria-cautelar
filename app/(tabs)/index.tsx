import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { EmptyState, IconButton, PrimaryButton, StatCard, StatusPill } from "@/components/inspection-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { Inspection, formatDate, fromRemoteInspection, getCityLabel, getPhotoCountLabel, getPropertyLabel, getStatusLabel, getInspectionStatusColor, inspectionProgress, listInspections, mergeLocalAndRemoteInspections, saveInspection, summarizeInspections } from "@/lib/inspection-storage";

function InspectionCard({ item, onPress }: { item: Inspection; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.cardTop}><View style={styles.cardCode}><Text style={styles.code}>{item.code}</Text><Text style={styles.cardDate}>{formatDate(item.updatedAt)}</Text></View><StatusPill label={getStatusLabel(item.status)} color={getInspectionStatusColor(item.status)} /></View>
    <Text style={styles.cardTitle}>{getPropertyLabel(item)}</Text>
    <Text style={styles.cardMeta}>{item.property.propertyType} · {getCityLabel(item)}</Text>
    <View style={styles.progressRow}><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${inspectionProgress(item)}%` }]} /></View><Text style={styles.progressText}>{inspectionProgress(item)}%</Text></View>
    <View style={styles.cardFooter}><Text style={styles.cardFooterText}>{getPhotoCountLabel(item)}</Text><Text style={styles.cardFooterText}>{item.location ? "GPS registrado" : "GPS pendente"}</Text><IconSymbol name="chevron.right" size={18} color={colors.muted} /></View>
  </Pressable>;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const remoteQuery = trpc.inspections.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [items, setItems] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setLoading(true); setItems(await listInspections()); setLoading(false); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!remoteQuery.data) return;
    const remote = remoteQuery.data.map(fromRemoteInspection);
    listInspections().then(async (local) => {
      const merged = mergeLocalAndRemoteInspections(local, remote);
      await Promise.all(remote.map(saveInspection));
      setItems(merged);
      setLoading(false);
    });
  }, [remoteQuery.data]);
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);
  const refresh = async () => { setRefreshing(true); await load(); if (isAuthenticated) await remoteQuery.refetch(); setRefreshing(false); };
  const summary = summarizeInspections(items);
  const canCreate = user?.role === "admin" || user?.permissions?.createInspections;

  return <ScreenContainer edges={["top", "left", "right"]} style={styles.container}>
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <InspectionCard item={item} onPress={() => router.push(`/inspection/${item.id}`)} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.header}><View><Text style={styles.overline}>CAMPO · VISTORIA CAUTELAR</Text><Text style={styles.title}>Inspeções</Text><Text style={styles.subtitle}>Registre imóveis com clareza, evidência e localização.</Text></View><View style={styles.headerMark}><IconSymbol name="checkmark.seal.fill" size={23} color="#FFFFFF" /></View></View>
        <View style={styles.actionBlock}><View style={styles.actionCopy}><Text style={styles.actionEyebrow}>NOVA COLETA</Text><Text style={styles.actionTitle}>Comece uma vistoria em campo</Text><Text style={styles.actionSubtitle}>{canCreate ? "Ficha técnica, fotos, GPS e parecer em um só fluxo." : "Seu usuário não possui liberação para criar novas vistorias."}</Text></View>{canCreate ? <PrimaryButton label="Nova vistoria" icon="plus.circle.fill" onPress={() => router.push("/inspection/new")} /> : null}</View>
        <View style={styles.stats}><StatCard value={String(summary.total)} label="total" icon="clipboard.fill" color="#2E7D62" /><StatCard value={String(summary.drafts)} label="em elaboração" icon="pencil" color="#C98525" /><StatCard value={String(summary.photos)} label="fotos" icon="photo.fill" color="#5D7290" /></View>
        <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Vistorias recentes</Text><Text style={styles.sectionSubtitle}>{items.length ? "Continue de onde parou." : "Seu histórico aparecerá aqui."}</Text></View>{items.length ? <IconButton icon="arrow.clockwise" label="Atualizar" onPress={refresh} color={colors.primary} /> : null}</View>
      </>}
      ListEmptyComponent={loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Carregando inspeções…</Text></View> : <EmptyState title="Nenhuma vistoria ainda" description={canCreate ? "Crie a primeira ficha para começar a documentar os imóveis." : "Não há registros disponíveis para este usuário."} action={canCreate ? <PrimaryButton label="Criar primeira vistoria" icon="plus.circle.fill" onPress={() => router.push("/inspection/new")} /> : undefined} />}
      ListFooterComponent={items.length ? <View style={styles.footerNote}><IconSymbol name="info.circle.fill" size={16} color={colors.muted} /><Text style={styles.footerText}>Os dados ficam salvos no dispositivo para uso mesmo sem internet.</Text></View> : null}
    />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#F7F8F4" },
  content: { padding: 20, paddingBottom: 34 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  overline: { color: "#2E7D62", letterSpacing: 1.4, fontSize: 10, fontWeight: "800", marginBottom: 8 },
  title: { color: "#1D2924", fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { color: "#738078", fontSize: 14, marginTop: 6 },
  headerMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#2E7D62", alignItems: "center", justifyContent: "center", shadowColor: "#2E7D62", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  actionBlock: { backgroundColor: "#203C31", borderRadius: 22, padding: 20, gap: 18, marginBottom: 16 },
  actionCopy: { maxWidth: 330 },
  actionEyebrow: { color: "#A9D4BE", fontSize: 10, letterSpacing: 1.3, fontWeight: "800", marginBottom: 7 },
  actionTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 27 },
  actionSubtitle: { color: "#C4D7CD", fontSize: 13, lineHeight: 18, marginTop: 6 },
  stats: { flexDirection: "row", gap: 9, marginBottom: 26 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#1D2924", fontSize: 19, fontWeight: "800" },
  sectionSubtitle: { color: "#738078", fontSize: 12, marginTop: 3 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 17, padding: 16, borderWidth: 1, borderColor: "#E1E7E2", marginBottom: 11 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardCode: { flexDirection: "row", alignItems: "center", gap: 8 },
  code: { color: "#2E7D62", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  cardDate: { color: "#9BA59F", fontSize: 11 },
  cardTitle: { color: "#1D2924", fontSize: 17, fontWeight: "800", marginTop: 14 },
  cardMeta: { color: "#738078", fontSize: 12, marginTop: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  progressTrack: { flex: 1, height: 6, borderRadius: 8, backgroundColor: "#E8EEE9", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 8, backgroundColor: "#2E7D62" },
  progressText: { color: "#2E7D62", fontSize: 11, fontWeight: "800", width: 31, textAlign: "right" },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EEF2EF" },
  cardFooterText: { color: "#738078", fontSize: 11, flex: 1 },
  loading: { alignItems: "center", paddingVertical: 42, gap: 10 },
  loadingText: { color: "#738078", fontSize: 13 },
  footerNote: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, paddingHorizontal: 5 },
  footerText: { color: "#8B968F", fontSize: 11, flex: 1 },
});

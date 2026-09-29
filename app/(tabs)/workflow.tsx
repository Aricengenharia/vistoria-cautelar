import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { fromRemoteInspection, getInspectionStatusColor, type InspectionStatus } from "@/lib/inspection-storage";
import { exportInspectionPdf } from "@/lib/report-pdf";
import { canAdvanceInspectionStatus, nextInspectionStatus, WORKFLOW_STATUSES } from "@/shared/inspection-workflow";

const ALL = "Todos" as const;
type StatusFilter = InspectionStatus | typeof ALL;
type UserFilter = number | typeof ALL;
type WorkflowInspection = { id: number; ownerUserId: number; sequentialCode: string; status: InspectionStatus; propertyAddress: string; propertyType: string | null; payload?: unknown; createdAt: string | Date; updatedAt: string | Date };
type WorkflowUser = { id: number; name: string | null; email: string | null };

function inspectorName(item: WorkflowInspection, users: WorkflowUser[]): string {
  if (item.payload && typeof item.payload === "object" && "inspectorName" in item.payload) {
    const value = (item.payload as { inspectorName?: unknown }).inspectorName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const owner = users.find((user) => user.id === item.ownerUserId);
  return owner?.name?.trim() || owner?.email || "Não informado";
}

function nextActionLabel(status: InspectionStatus): string {
  if (status === "Em elaboração") return "Concluir relatório";
  if (status === "Concluído") return "Enviar para conferência";
  if (status === "Conferido") return "Aprovar relatório";
  return "Relatório aprovado";
}

export default function WorkflowScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const canOpen = Boolean(user && (user.role === "admin" || user.permissions?.viewAllInspections || user.permissions?.createInspections || user.permissions?.reviewInspections || user.permissions?.approveInspections || user.permissions?.manageUsers));
  const dashboard = trpc.admin.dashboard.useQuery(undefined, { enabled: Boolean(user && canOpen), retry: false });
  const updateStatus = trpc.inspections.update.useMutation({ onSuccess: () => dashboard.refetch() });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL);
  const [userFilter, setUserFilter] = useState<UserFilter>(ALL);
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const items = useMemo(() => (dashboard.data?.inspections ?? []) as WorkflowInspection[], [dashboard.data]);
  const users = useMemo(() => (dashboard.data?.users ?? []) as WorkflowUser[], [dashboard.data]);
  const isAdmin = user?.role === "admin";
  const canExport = isAdmin || Boolean(user?.permissions?.exportReports);
  const canSetStatus = (status: InspectionStatus) => isAdmin || (status === "Concluído" && Boolean(user?.permissions?.editInspections)) || (status === "Conferido" && Boolean(user?.permissions?.reviewInspections)) || (status === "Aprovado" && Boolean(user?.permissions?.approveInspections));
  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === ALL || item.status === statusFilter;
      const matchesUser = userFilter === ALL || item.ownerUserId === userFilter;
      const matchesSearch = !normalizedSearch || `${item.sequentialCode} ${item.propertyAddress} ${inspectorName(item, users)}`.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesUser && matchesSearch;
    });
  }, [items, search, statusFilter, userFilter, users]);
  const counts = useMemo(() => Object.fromEntries(WORKFLOW_STATUSES.map((status) => [status, items.filter((item) => item.status === status).length])) as Record<InspectionStatus, number>, [items]);
  const changeStatus = async (item: WorkflowInspection) => {
    const next = nextInspectionStatus(item.status);
    if (!next || !canSetStatus(next) || !canAdvanceInspectionStatus(item.status, next)) return;
    try {
      await updateStatus.mutateAsync({ id: item.id, status: next });
      Alert.alert("Fluxo atualizado", `${item.sequentialCode} avançou para ${next}.`);
    } catch (error) {
      Alert.alert("Não foi possível avançar", error instanceof Error ? error.message : "Verifique a atribuição do usuário.");
    }
  };
  const exportReport = async (item: WorkflowInspection) => {
    if (!canExport || exportingId !== null) return;
    setExportingId(item.id);
    try {
      const payload = item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {};
      const report = fromRemoteInspection({ ...item, payload });
      await exportInspectionPdf(report);
    } catch (error) {
      Alert.alert("Não foi possível gerar o PDF", error instanceof Error ? error.message : "Tente novamente e verifique se o navegador permite pop-ups.");
    } finally {
      setExportingId(null);
    }
  };

  if (loading || dashboard.isLoading) return <Center text="Carregando controle de status…" />;
  if (!user) return <Access title="Acesso necessário" text="Entre com seu e-mail e senha para acompanhar o workflow." action="Ir para o login" onPress={() => router.push("/login")} />;
  if (!canOpen) return <Access title="Aba sem liberação" text="Seu usuário não possui permissão para acompanhar o fluxo dos relatórios." action="Voltar" onPress={() => router.replace("/")} />;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <FlatList
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.header}><View style={styles.headerIcon}><IconSymbol name="arrow.triangle.2.circlepath" size={25} color="#fff" /></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>WORKFLOW DOS RELATÓRIOS</Text><Text style={styles.title}>Controle de status</Text><Text style={styles.subtitle}>Acompanhe cada vistoria por usuário e avance somente para a próxima etapa permitida.</Text></View></View>
        <View style={styles.workflowRail}>{WORKFLOW_STATUSES.map((status, index) => <View key={status} style={styles.workflowStage}><View style={[styles.workflowDot, { backgroundColor: getInspectionStatusColor(status) }]}><Text style={styles.workflowDotText}>{index + 1}</Text></View><Text style={styles.workflowLabel}>{status}</Text>{index < WORKFLOW_STATUSES.length - 1 ? <View style={styles.workflowLine} /> : null}</View>)}</View>
        <View style={styles.summaryRow}>{WORKFLOW_STATUSES.map((status) => <View key={status} style={[styles.summaryCard, { borderTopColor: getInspectionStatusColor(status) }]}><Text style={[styles.summaryValue, { color: getInspectionStatusColor(status) }]}>{counts[status]}</Text><Text style={styles.summaryLabel}>{status}</Text></View>)}</View>
        <View style={styles.filterCard}><View style={styles.filterTitleRow}><Text style={styles.filterTitle}>Filtros</Text><Pressable onPress={() => { setStatusFilter(ALL); setUserFilter(ALL); setSearch(""); }}><Text style={styles.clear}>Limpar filtros</Text></Pressable></View><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por código, endereço ou vistoriador" placeholderTextColor="#9AA59E" style={styles.search} /><Text style={styles.filterLabel}>USUÁRIO / VISTORIADOR</Text><View style={styles.chipRow}><FilterChip label="Todos" selected={userFilter === ALL} onPress={() => setUserFilter(ALL)} />{users.map((candidate) => <FilterChip key={candidate.id} label={candidate.name || candidate.email || `Usuário ${candidate.id}`} selected={userFilter === candidate.id} onPress={() => setUserFilter(candidate.id)} />)}</View><Text style={styles.filterLabel}>ETAPA DO WORKFLOW</Text><View style={styles.chipRow}><FilterChip label={`Todos (${items.length})`} selected={statusFilter === ALL} onPress={() => setStatusFilter(ALL)} />{WORKFLOW_STATUSES.map((status) => <FilterChip key={status} label={`${status} (${counts[status]})`} selected={statusFilter === status} color={getInspectionStatusColor(status)} onPress={() => setStatusFilter(status)} />)}</View></View><Text style={styles.resultTitle}>{filtered.length} {filtered.length === 1 ? "relatório encontrado" : "relatórios encontrados"}</Text>
      </>}
      ListEmptyComponent={<View style={styles.empty}><IconSymbol name="clipboard.fill" size={30} color="#93A79A" /><Text style={styles.emptyTitle}>Nenhum relatório neste filtro</Text><Text style={styles.emptyText}>Altere o usuário, a etapa ou a busca para encontrar outras vistorias.</Text></View>}
      renderItem={({ item }) => { const next = nextInspectionStatus(item.status); const canAdvance = Boolean(next && canSetStatus(next)); return <View style={styles.reportCard}><View style={styles.reportTop}><View><Text style={styles.code}>{item.sequentialCode}</Text><Text style={styles.address}>{item.propertyAddress}</Text></View><View style={[styles.statusPill, { backgroundColor: `${getInspectionStatusColor(item.status)}16`, borderColor: `${getInspectionStatusColor(item.status)}50` }]}><Text style={[styles.statusPillText, { color: getInspectionStatusColor(item.status) }]}>{item.status}</Text></View></View><Text style={styles.meta}>{item.propertyType || "Tipo não informado"}</Text><Text style={styles.inspector}>Vistoriador: <Text style={styles.inspectorValue}>{inspectorName(item, users)}</Text></Text><View style={styles.progressTrack}>{WORKFLOW_STATUSES.map((status, index) => <View key={status} style={[styles.progressSegment, { backgroundColor: WORKFLOW_STATUSES.indexOf(item.status) >= index ? getInspectionStatusColor(status) : "#E6ECE8" }, index < WORKFLOW_STATUSES.length - 1 && styles.progressGap]} />)}</View><View style={styles.reportFooter}>{canAdvance ? <Pressable disabled={updateStatus.isPending} onPress={() => changeStatus(item)} style={[styles.advanceButton, { backgroundColor: getInspectionStatusColor(next!) }]}><Text style={styles.advanceText}>{updateStatus.isPending ? "Atualizando…" : nextActionLabel(item.status)}</Text><IconSymbol name="chevron.right" size={16} color="#fff" /></Pressable> : <Text style={styles.nextHint}>{item.status === "Aprovado" ? "Fluxo concluído" : `Próxima etapa: ${next || "—"} · sem liberação para avançar`}</Text>}<Pressable onPress={() => router.push({ pathname: "/inspection/new", params: { serverId: String(item.id) } })} style={styles.detailButton}><Text style={styles.detailText}>Abrir vistoria</Text></Pressable>{canExport ? <Pressable disabled={exportingId !== null} onPress={() => exportReport(item)} style={styles.pdfButton}><Text style={styles.pdfText}>{exportingId === item.id ? "Gerando PDF…" : "Exportar PDF"}</Text></Pressable> : null}</View></View>; }}
    />
  </ScreenContainer>;
}

function FilterChip({ label, selected, color = "#2E7D62", onPress }: { label: string; selected: boolean; color?: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.filterChip, selected && { backgroundColor: color, borderColor: color }]}><Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text></Pressable>; }
function Center({ text }: { text: string }) { return <ScreenContainer style={styles.center}><ActivityIndicator color="#2E7D62" /><Text style={styles.centerText}>{text}</Text></ScreenContainer>; }
function Access({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) { return <ScreenContainer style={styles.center}><View style={styles.access}><IconSymbol name="shield.fill" size={28} color="#2E7D62" /><Text style={styles.accessTitle}>{title}</Text><Text style={styles.accessText}>{text}</Text><Pressable onPress={onPress} style={styles.accessButton}><Text style={styles.accessButtonText}>{action}</Text></Pressable></View></ScreenContainer>; }

const styles = StyleSheet.create({ screen: { backgroundColor: "#F7F8F4" }, content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 22, paddingBottom: 60 }, center: { backgroundColor: "#F7F8F4", alignItems: "center", justifyContent: "center" }, centerText: { color: "#738078", marginTop: 9 }, header: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18 }, headerIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#2E7D62", alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1 }, eyebrow: { color: "#2E7D62", fontSize: 9, fontWeight: "800", letterSpacing: 1.3 }, title: { color: "#1D2924", fontSize: 28, fontWeight: "800", marginTop: 4 }, subtitle: { color: "#738078", fontSize: 12, lineHeight: 18, marginTop: 4 }, workflowRail: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, padding: 15, marginBottom: 12 }, workflowStage: { flex: 1, alignItems: "center", position: "relative" }, workflowDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", zIndex: 2 }, workflowDotText: { color: "#fff", fontSize: 11, fontWeight: "800" }, workflowLabel: { color: "#43564B", fontSize: 9, fontWeight: "800", textAlign: "center", marginTop: 6 }, workflowLine: { position: "absolute", top: 13, left: "50%", right: "-50%", height: 2, backgroundColor: "#DCE7DF", zIndex: 1 }, summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }, summaryCard: { flex: 1, minWidth: 130, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderTopWidth: 3, borderRadius: 12, padding: 12 }, summaryValue: { fontSize: 22, fontWeight: "800" }, summaryLabel: { color: "#738078", fontSize: 9, marginTop: 3 }, filterCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, padding: 15, marginBottom: 20 }, filterTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, filterTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800" }, clear: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, search: { minHeight: 44, borderWidth: 1, borderColor: "#D8E1DB", borderRadius: 10, paddingHorizontal: 12, color: "#1D2924", backgroundColor: "#FBFCFA", marginTop: 11, marginBottom: 11 }, filterLabel: { color: "#405149", fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginTop: 8, marginBottom: 6 }, chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, filterChip: { borderWidth: 1, borderColor: "#C8D5CD", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "#fff" }, filterChipText: { color: "#56675E", fontSize: 9, fontWeight: "700" }, filterChipTextActive: { color: "#fff" }, resultTitle: { color: "#1D2924", fontSize: 16, fontWeight: "800", marginBottom: 9 }, reportCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 15, padding: 15, marginBottom: 10 }, reportTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }, code: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, address: { color: "#1D2924", fontSize: 14, fontWeight: "800", marginTop: 6 }, statusPill: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 }, statusPillText: { fontSize: 9, fontWeight: "800" }, meta: { color: "#738078", fontSize: 10, marginTop: 3 }, inspector: { color: "#738078", fontSize: 10, marginTop: 10 }, inspectorValue: { color: "#1D2924", fontWeight: "700" }, progressTrack: { flexDirection: "row", marginTop: 14, height: 7 }, progressSegment: { flex: 1, borderRadius: 4 }, progressGap: { marginRight: 3 }, reportFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 14 }, advanceButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, flexShrink: 1 }, advanceText: { color: "#fff", fontSize: 10, fontWeight: "800" }, nextHint: { color: "#738078", fontSize: 10, flex: 1 }, detailButton: { borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, detailText: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, pdfButton: { borderWidth: 1, borderColor: "#C9B7DF", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#FBF8FF" }, pdfText: { color: "#6D4D8F", fontSize: 10, fontWeight: "800" }, empty: { backgroundColor: "#fff", borderRadius: 15, alignItems: "center", padding: 28 }, emptyTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 9 }, emptyText: { color: "#738078", fontSize: 11, textAlign: "center", marginTop: 5 }, access: { width: "90%", maxWidth: 400, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 18, padding: 24, alignItems: "center" }, accessTitle: { color: "#1D2924", fontSize: 18, fontWeight: "800", marginTop: 9 }, accessText: { color: "#738078", fontSize: 11, marginTop: 5, textAlign: "center" }, accessButton: { backgroundColor: "#2E7D62", borderRadius: 9, padding: 10, marginTop: 14 }, accessButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" } });

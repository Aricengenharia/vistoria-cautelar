import { useMemo } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { buildPublicInspectionUrl } from "@/lib/public-link";
import { getInspectionStatusColor, type InspectionStatus } from "@/lib/inspection-storage";

const ORIGIN = "https://vistoriacam-jawdo3wh.manus.space";
const STATUS_OPTIONS: InspectionStatus[] = ["Em elaboração", "Concluído", "Conferido", "Aprovado"];

type DashboardInspection = {
  id: number;
  ownerUserId: number;
  sequentialCode: string;
  status: InspectionStatus;
  propertyAddress: string;
  propertyType: string | null;
  payload?: unknown;
};

function getInspectorName(item: DashboardInspection, users: Array<{ id: number; name: string | null; email: string | null }>, currentUser?: { id: number; name: string | null; email: string | null } | null): string {
  const payload = item.payload;
  if (payload && typeof payload === "object" && "inspectorName" in payload) {
    const value = (payload as { inspectorName?: unknown }).inspectorName;
    if (typeof value === "string" && value.trim()) return value;
  }
  const owner = users.find((candidate) => candidate.id === item.ownerUserId) ?? (currentUser?.id === item.ownerUserId ? currentUser : undefined);
  if (owner?.name?.trim()) return owner.name.trim();
  if (owner?.email) return owner.email;
  return "Não informado";
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const canOpenPanel = Boolean(user && (user.role === "admin" || user.permissions?.manageUsers || user.permissions?.viewAllInspections || user.permissions?.createInspections));
  const dashboard = trpc.admin.dashboard.useQuery(undefined, { enabled: Boolean(user && canOpenPanel), retry: false });
  const share = trpc.inspections.createPublicLink.useMutation();
  const updateStatus = trpc.inspections.update.useMutation({ onSuccess: () => dashboard.refetch() });
  const items = useMemo(() => (dashboard.data?.inspections ?? []) as DashboardInspection[], [dashboard.data]);
  const totals = dashboard.data?.totals ?? { users: 0, inspections: 0, elaborating: 0, concluded: 0, reviewed: 0, approved: 0 };
  const signOut = async () => { await logout(); router.replace("/login"); };
  const isAdmin = user?.role === "admin";
  const canSetStatus = (status: InspectionStatus) => isAdmin || (status === "Concluído" && Boolean(user?.permissions?.editInspections)) || (status === "Conferido" && Boolean(user?.permissions?.reviewInspections)) || (status === "Aprovado" && Boolean(user?.permissions?.approveInspections));
  const copy = async (id: number) => { try { const result = await share.mutateAsync({ id }); if (!result?.publicToken) return; const origin = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : ORIGIN; await Clipboard.setStringAsync(buildPublicInspectionUrl(origin, result.publicToken)); Alert.alert("Link copiado", "O link público foi copiado."); } catch (error) { Alert.alert("Não foi possível criar o link", error instanceof Error ? error.message : "Tente novamente."); } };
  const changeStatus = async (item: DashboardInspection, status: InspectionStatus) => { if (status === item.status || !canSetStatus(status)) return; try { await updateStatus.mutateAsync({ id: item.id, status }); Alert.alert("Status atualizado", `${item.sequentialCode} agora está ${status}.`); } catch (error) { Alert.alert("Não foi possível atualizar", error instanceof Error ? error.message : "Verifique a atribuição do usuário."); } };

  if (loading) return <Center text="Verificando acesso…" />;
  if (!user) return <Access title="Acesso necessário" text="Entre com seu e-mail e senha." action="Ir para o login" onPress={() => router.push("/login")} />;
  if (!canOpenPanel) return <Access title="Painel sem liberação" text="Seu usuário não possui uma atribuição para visualizar as vistorias." action="Sair da conta" onPress={signOut} />;
  if (dashboard.isLoading) return <Center text="Carregando painel…" />;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>GESTÃO WEB</Text><Text style={styles.title}>Painel de inspeções</Text><Text style={styles.subtitle}>Acompanhe o responsável, o andamento e as liberações de cada relatório.</Text></View><View style={styles.headerRight}><View style={styles.icon}><IconSymbol name="chart.bar.fill" size={24} color="#fff" /></View><Pressable onPress={signOut} style={styles.logout}><Text style={styles.logoutText}>Sair</Text></Pressable></View></View>
        <View style={styles.metrics}><Metric label="Vistorias" value={totals.inspections} /><Metric label="Em elaboração" value={totals.elaborating} /><Metric label="Concluídos" value={totals.concluded} /><Metric label="Conferidos" value={totals.reviewed} /><Metric label="Aprovados" value={totals.approved} />{user.permissions.manageUsers || isAdmin ? <Metric label="Usuários" value={totals.users} /> : null}</View>
        <View style={styles.actions}><Action label="Nova vistoria pela web" primary onPress={() => router.push("/inspection/new")} />{user.role === "admin" || user.permissions?.viewAllInspections ? <Action label="Galeria de fotos" onPress={() => router.push("/gallery" as any)} /> : null}{user.permissions.manageUsers || isAdmin ? <Action label="Usuários e liberações" onPress={() => router.push("/users" as any)} /> : null}</View>
        <Text style={styles.section}>Vistorias recentes</Text>
      </>}
      ListEmptyComponent={<Text style={styles.empty}>Nenhuma vistoria sincronizada.</Text>}
      renderItem={({ item }) => <View style={styles.card}>
        <View style={styles.top}><Text style={styles.code}>{item.sequentialCode}</Text><Text style={[styles.status, { color: getInspectionStatusColor(item.status) }]}>{item.status}</Text></View>
        <Text style={styles.address}>{item.propertyAddress}</Text><Text style={styles.meta}>{item.propertyType || "Tipo não informado"}</Text><Text style={styles.inspector}>Vistoriador: <Text style={styles.inspectorName}>{getInspectorName(item, (dashboard.data?.users ?? []) as Array<{ id: number; name: string | null; email: string | null }>, user)}</Text></Text>
        <Text style={styles.statusHint}>Atualizar andamento:</Text><View style={styles.statusRow}>{STATUS_OPTIONS.map((status) => { const enabled = canSetStatus(status); return <Pressable key={status} disabled={!enabled || updateStatus.isPending} onPress={() => changeStatus(item, status)} style={[styles.statusChip, item.status === status && { backgroundColor: getInspectionStatusColor(status), borderColor: getInspectionStatusColor(status) }, !enabled && styles.statusChipDisabled]}><Text style={[styles.statusChipText, item.status === status && styles.statusChipTextActive, !enabled && styles.statusChipTextDisabled]}>{status}</Text></Pressable>; })}</View>
        <View style={styles.cardActions}><Pressable onPress={() => router.push({ pathname: "/inspection/new", params: { serverId: String(item.id) } })} style={styles.open}><Text style={styles.openText}>Abrir e editar</Text></Pressable><Pressable onPress={() => copy(item.id)} style={styles.link}><Text style={styles.linkText}>Copiar link</Text></Pressable></View>
      </View>}
    />
  </ScreenContainer>;
}

function Metric({ label, value }: { label: string; value: number }) { return <View style={styles.metric}><Text style={styles.value}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Action({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}><Text style={[styles.actionText, primary && { color: "#fff" }]}>{label}</Text></Pressable>; }
function Center({ text }: { text: string }) { return <ScreenContainer style={styles.center}><ActivityIndicator color="#2E7D62" /><Text style={styles.centerText}>{text}</Text></ScreenContainer>; }
function Access({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) { return <ScreenContainer style={styles.center}><View style={styles.access}><IconSymbol name="shield.fill" size={28} color="#2E7D62" /><Text style={styles.accessTitle}>{title}</Text><Text style={styles.accessText}>{text}</Text><Pressable onPress={onPress} style={styles.accessButton}><Text style={styles.accessButtonText}>{action}</Text></Pressable></View></ScreenContainer>; }

const styles = StyleSheet.create({ screen: { backgroundColor: "#F7F8F4" }, content: { width: "100%", maxWidth: 1100, alignSelf: "center", padding: 24, paddingBottom: 50 }, center: { backgroundColor: "#F7F8F4", alignItems: "center", justifyContent: "center" }, centerText: { color: "#738078", marginTop: 9 }, header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }, headerCopy: { flex: 1 }, headerRight: { alignItems: "flex-end", gap: 7 }, logout: { borderWidth: 1, borderColor: "#D9AAA5", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#FFF8F7" }, logoutText: { color: "#A93D37", fontSize: 11, fontWeight: "800" }, eyebrow: { color: "#2E7D62", fontSize: 9, fontWeight: "800", letterSpacing: 1.3 }, title: { color: "#1D2924", fontSize: 28, fontWeight: "800", marginTop: 5 }, subtitle: { color: "#738078", fontSize: 12, marginTop: 4, maxWidth: 650 }, icon: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#2E7D62", alignItems: "center", justifyContent: "center" }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 13 }, metric: { flex: 1, minWidth: 120, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 14, padding: 14 }, value: { color: "#1D2924", fontSize: 23, fontWeight: "800" }, metricLabel: { color: "#738078", fontSize: 10, marginTop: 2 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 25 }, action: { flex: 1, minWidth: 220, minHeight: 47, borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, actionPrimary: { backgroundColor: "#2E7D62", borderColor: "#2E7D62" }, actionText: { color: "#2E7D62", fontSize: 11, fontWeight: "800" }, section: { color: "#1D2924", fontSize: 17, fontWeight: "800", marginBottom: 10 }, empty: { color: "#738078", textAlign: "center", padding: 30 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 14, padding: 15, marginBottom: 9 }, top: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, code: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, status: { fontSize: 10, fontWeight: "800", textAlign: "right" }, address: { color: "#1D2924", fontSize: 14, fontWeight: "800", marginTop: 10 }, meta: { color: "#738078", fontSize: 10, marginTop: 3 }, inspector: { color: "#738078", fontSize: 11, marginTop: 9 }, inspectorName: { color: "#1D2924", fontWeight: "700" }, statusHint: { color: "#738078", fontSize: 10, fontWeight: "700", marginTop: 13, marginBottom: 6 }, statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, statusChip: { borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "#fff" }, statusChipDisabled: { opacity: 0.45 }, statusChipText: { color: "#2E7D62", fontSize: 9, fontWeight: "800" }, statusChipTextActive: { color: "#fff" }, statusChipTextDisabled: { color: "#738078" }, cardActions: { flexDirection: "row", gap: 8, marginTop: 12 }, open: { backgroundColor: "#2E7D62", borderRadius: 8, padding: 9 }, openText: { color: "#fff", fontSize: 10, fontWeight: "800" }, link: { borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 8, padding: 9 }, linkText: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, access: { width: "90%", maxWidth: 400, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 18, padding: 24, alignItems: "center" }, accessTitle: { color: "#1D2924", fontSize: 18, fontWeight: "800", marginTop: 9 }, accessText: { color: "#738078", fontSize: 11, marginTop: 5, textAlign: "center" }, accessButton: { backgroundColor: "#2E7D62", borderRadius: 9, padding: 10, marginTop: 14 }, accessButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" } });

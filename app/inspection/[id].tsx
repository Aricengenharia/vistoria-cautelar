import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconButton, PrimaryButton, SectionTitle, StatusPill } from "@/components/inspection-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { Inspection, formatDate, getAddressLabel, getCityLabel, getDocumentStatus, getLocationAccuracy, getPhotoMeta, getQuestionnaireStatus, getReportDescription, getReportDisclaimer, getReportIntro, getReportLocation, getReportMethod, getReportOpinion, getReportReadiness, getReportReadinessColor, getReportSectionCount, getReportStatusCopy, getReportTitle, getReportVulnerability, getOwnerLabel, getInspectionStatusColor, getStatusLabel, listInspections, vulnerabilityColor } from "@/lib/inspection-storage";
import { exportInspectionPdf } from "@/lib/report-pdf";
import { useAuth } from "@/hooks/use-auth";

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { user, loading: authLoading } = useAuth();
  const [item, setItem] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => { setLoading(true); const items = await listInspections(); setItem(items.find((value) => value.id === id) ?? null); setLoading(false); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || authLoading) return <ScreenContainer style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Abrindo vistoria…</Text></ScreenContainer>;
  if (!user) return <ScreenContainer style={styles.center}><Text style={styles.notFound}>Acesso necessário</Text><PrimaryButton label="Ir para o login" onPress={() => router.replace("/login")} /></ScreenContainer>;
  if (!item) return <ScreenContainer style={styles.center}><Text style={styles.notFound}>Vistoria não encontrada</Text><PrimaryButton label="Voltar para inspeções" onPress={() => router.replace("/")} /></ScreenContainer>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.topbar}><IconButton icon="chevron.left" label="Voltar" onPress={() => router.back()} color={colors.foreground} /><View style={styles.topbarCopy}><Text style={styles.overline}>REVISÃO DA VISTORIA</Text><Text style={styles.topbarTitle}>{item.code}</Text></View>{user.role === "admin" || user.permissions.editInspections ? <IconButton icon="pencil" label="Editar" onPress={() => router.push({ pathname: "/inspection/new", params: { id: item.id } })} color={colors.primary} /> : null}</View>
      {user.role === "admin" || user.permissions.exportReports ? <PrimaryButton label={exporting ? "Gerando relatório PDF…" : "Exportar relatório em PDF"} icon="document.fill" onPress={async () => { setExporting(true); try { await exportInspectionPdf({ ...item, inspectorName: item.inspectorName || user.name?.trim() || user.email || "Não informado" }); } catch (error) { Alert.alert("Não foi possível gerar o relatório", error instanceof Error ? error.message : "Tente novamente e verifique se o navegador permite pop-ups."); } finally { setExporting(false); } }} disabled={exporting} /> : null}
      <View style={styles.hero}><View style={styles.heroTop}><StatusPill label={getStatusLabel(item.status)} color={getInspectionStatusColor(item.status)} /><Text style={styles.heroDate}>{formatDate(item.createdAt)}</Text></View><Text style={styles.heroTitle}>{getReportTitle(item)}</Text><Text style={styles.heroSubtitle}>{getAddressLabel(item)}</Text><Text style={styles.heroLocation}>{getCityLabel(item)}</Text><View style={styles.heroFooter}><Text style={styles.heroFooterText}>{getReportStatusCopy(item)}</Text><Text style={[styles.heroReady, { color: getReportReadinessColor(item) }]}>{getReportReadiness(item)}</Text></View></View>
      <View style={styles.quickGrid}><QuickInfo icon="location.fill" label="Localização" value={item.location ? "Registrada" : "Pendente"} color="#2E7D62" /><QuickInfo icon="photo.fill" label="Registros" value={`${item.photos.length} fotos`} color="#5D7290" /><QuickInfo icon="map.fill" label="Ambientes" value={`${item.environments.length} áreas`} color="#96744E" /><QuickInfo icon="checkmark.seal.fill" label="Seções" value={getReportSectionCount(item)} color="#7C659B" /></View>
      <SectionTitle eyebrow="relatório técnico" title="Dados registrados" detail={getReportIntro()} />
      <ReportBlock title="Ficha técnica de campo" icon="clipboard.fill"><InfoRow label="Obra" value={item.property.workName || "Não informado"} /><InfoRow label="Vistoriador" value={item.inspectorName || user.name?.trim() || user.email || "Não informado"} /><InfoRow label="Conferido por" value={item.reviewerName || "Ainda não conferido"} /><InfoRow label="Aprovado por" value={item.approverName || "Ainda não aprovado"} /><InfoRow label="Status do relatório" value={getStatusLabel(item.status)} /><InfoRow label="Data da vistoria" value={item.property.inspectionDate || "Não informado"} /><InfoRow label="Código sequencial" value={item.property.sequentialCode || item.code} /><InfoRow label="Responsável / ocupante" value={getOwnerLabel(item)} /><InfoRow label="Tipo de imóvel" value={item.property.propertyType} /><InfoRow label="Endereço" value={getAddressLabel(item)} /><InfoRow label="Idade aproximada do imóvel" value={item.property.approximateAge || "Não informado"} /><InfoRow label="Idade aproximada da última reforma" value={item.property.lastRenovationAge || "Não informado"} /><InfoRow label="Tipo de edificação" value={item.property.buildingType || "Não informado"} /><InfoRow label="Situação" value={item.property.situation || "Não informado"} /><InfoRow label="Garagem" value={item.property.garagePossession ? `${item.property.garagePossession} · ${item.property.garageSpaces || "vagas não informadas"}` : item.property.garage || "Não informado"} /><InfoRow label="Pavimentos do imóvel" value={`${item.property.propertyFloors || "Não informado"}${item.property.propertyFloors === "Outros" && item.property.propertyFloorsOther ? ` (${item.property.propertyFloorsOther})` : ""}`} /><InfoRow label="Subsolos" value={item.property.basements || "Não informado"} /><InfoRow label="Total de pavimentos da edificação" value={`${item.property.totalBuildingFloors || "Não informado"}${item.property.totalBuildingFloors === "Outros" && item.property.totalBuildingFloorsOther ? ` (${item.property.totalBuildingFloorsOther})` : ""}`} /><InfoRow label="Referências" value={getDocumentStatus(item)} /></ReportBlock>
      <ReportBlock title="Descrição e metodologia" icon="building.2.fill"><Text style={styles.bodyText}>{getReportDescription(item)}</Text><Text style={styles.subLabel}>METODOLOGIA</Text><Text style={styles.bodyText}>{getReportMethod(item)}</Text></ReportBlock>
      <ReportBlock title="Localização do imóvel" icon="location.fill"><View style={styles.locationSummary}><IconSymbol name="location.fill" size={20} color="#2E7D62" /><View style={styles.locationSummaryCopy}><Text style={styles.locationValue}>{getReportLocation(item)}</Text><Text style={styles.smallText}>{getLocationAccuracy(item.location)}</Text></View></View><Text style={styles.smallText}>{item.location ? `Capturado em ${formatDate(item.location.capturedAt)}` : "Nenhum ponto foi capturado"}</Text></ReportBlock>
      <ReportBlock title="Croqui da planta" icon="map.fill">{item.sketch.mode === "image" && item.sketch.uri ? <Image source={{ uri: item.sketch.uri }} style={styles.sketchPreview} /> : <Text style={styles.bodyText}>{item.sketch.strokes.length ? "Croqui desenhado no dispositivo." : "Nenhum croqui registrado."}</Text>}</ReportBlock>
      <ReportBlock title="Área externa" icon="building.2.fill"><InfoRow label="Status" value={item.externalArea.enabled ? "Checklist preenchido" : "Não vistoriada"} />{item.externalArea.enabled ? <Text style={styles.bodyText}>{item.externalArea.observations || "Sem observações gerais."}</Text> : null}</ReportBlock>
      <ReportBlock title="Características construtivas" icon="building.2.fill"><InfoRow label="Estado de conservação" value={item.conservation || "Não informado"} /><InfoRow label="Padrão construtivo" value={item.constructionStandard || "Não informado"} /><InfoRow label="Tipo de estrutura" value={item.structureType || "Não informado"} /><InfoRow label="Tipo de cobertura" value={item.roofType || "Não informado"} /></ReportBlock>
      <ReportBlock title="Ambientes e relatório fotográfico" icon="photo.fill"><Text style={styles.smallText}>Cada ambiente reúne suas observações, acabamentos, patologias e registros fotográficos.</Text><View style={styles.environmentList}>{item.environments.map((environment, index) => <EnvironmentReview key={environment} item={item} environment={environment} index={index} />)}</View><View style={[styles.riskBox, { backgroundColor: `${vulnerabilityColor(item.vulnerabilityLevel)}14`, borderColor: `${vulnerabilityColor(item.vulnerabilityLevel)}44` }]}><View style={[styles.riskDot, { backgroundColor: vulnerabilityColor(item.vulnerabilityLevel) }]} /><View><Text style={[styles.riskTitle, { color: vulnerabilityColor(item.vulnerabilityLevel) }]}>Vulnerabilidade {item.vulnerabilityLevel.toLowerCase()}</Text><Text style={styles.smallText}>{getReportVulnerability(item).split(" · ")[1]}</Text></View></View></ReportBlock>
      <ReportBlock title="Questionário do ocupante" icon="person.fill"><InfoRow label="Status" value={item.occupantSurvey.completed || getQuestionnaireStatus(item)} /><InfoRow label="Responsável pelas informações" value={item.occupantSurvey.responsible || item.questionnaire.occupantName || "Não informado"} /><InfoRow label="Documentações" value={Object.keys(item.occupantSurvey).length ? "Questionário registrado" : "Não informado"} /><InfoRow label="Autorização de entrada" value={item.entryAccess.status === "Não foi possível" ? "Vistoria não realizada: entrada não autorizada" : item.entryAccess.status || "Não informado"} />{item.entryAccess.status === "Não foi possível" ? <View style={styles.entryAccessReview}>{item.entryAccess.attempts.map((attempt, index) => <View key={`attempt-review-${index}`}><InfoRow label={`${index + 1}ª tentativa`} value={`${attempt.date || "Data não informada"} · ${attempt.time || "Horário não informado"}`} />{attempt.photoUri ? <Image source={{ uri: attempt.photoUri }} style={styles.entryAttemptReviewPhoto} /> : null}</View>)}</View> : null}<InfoRow label="Obras anteriores" value={item.questionnaire.priorWorks || "Não informado"} /><InfoRow label="Trincas ou fissuras prévias" value={item.questionnaire.priorCracks || "Não informado"} /><InfoRow label="Vibração ou ruído" value={item.questionnaire.observedVibration || "Não informado"} /><InfoRow label="Comentários" value={item.questionnaire.comments || "Não informado"} /><InfoRow label="Alterações realizadas na reforma" value={item.occupantSurvey.renovationChanges || "Não informado"} />{item.projectDocumentUri ? <Image source={{ uri: item.projectDocumentUri }} style={styles.projectDocumentReview} /> : null}</ReportBlock>
      <ReportBlock title="Parecer" icon="checkmark.seal.fill"><Text style={styles.bodyText}>{getReportOpinion(item)}</Text><Text style={styles.disclaimer}>{getReportDisclaimer()}</Text></ReportBlock>
      <ReportBlock title="Assinaturas" icon="pencil"><InfoRow label="Responsável pelas informações" value={item.signatures.responsible.length ? "Assinatura registrada" : "Não registrada"} /><InfoRow label="Ocupante" value={item.signatures.occupant.length ? "Assinatura registrada" : "Não registrada"} /></ReportBlock>
      <View style={styles.footer}><IconSymbol name="checkmark.seal.fill" size={18} color="#2E7D62" /><Text style={styles.footerText}>Dados salvos localmente · {item.code}</Text></View>
    </ScrollView>
  </ScreenContainer>;
}

function QuickInfo({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) { return <View style={styles.quickCard}><View style={[styles.quickIcon, { backgroundColor: `${color}14` }]}><IconSymbol name={icon} size={17} color={color} /></View><Text style={styles.quickLabel}>{label}</Text><Text style={styles.quickValue}>{value}</Text></View>; }
function ReportBlock({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) { return <View style={styles.reportBlock}><View style={styles.blockHeader}><IconSymbol name={icon} size={18} color="#2E7D62" /><Text style={styles.blockTitle}>{title}</Text></View>{children}</View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

function EnvironmentReview({ item, environment, index }: { item: Inspection; environment: string; index: number }) {
  const detail = item.environmentDetails?.[environment];
  const photos = item.photos.filter((photo) => photo.environment === environment);
  return <View style={styles.environmentCard}>
    <View style={styles.environmentHeader}><View style={styles.environmentNumber}><Text style={styles.environmentNumberText}>{String(index + 1).padStart(2, "0")}</Text></View><View style={styles.environmentHeaderCopy}><Text style={styles.environmentTitle}>{environment}</Text><Text style={styles.environmentMeta}>{photos.length} {photos.length === 1 ? "foto" : "fotos"}</Text></View></View>
    <InfoRow label="Observações gerais" value={detail?.observations || "Não informado"} />
    <InfoRow label="Acabamentos" value={detail?.finishes || "Não informado"} />
    <InfoRow label="Patologias / anomalias" value={detail?.pathologies || "Nenhuma patologia descrita"} />
    {photos.length ? <View style={styles.photoList}>{photos.map((photo, photoIndex) => <View key={photo.id} style={styles.photoRow}><Image source={{ uri: photo.uri }} style={styles.thumb} /><View style={styles.photoRowCopy}><Text style={styles.photoTitle}>{environment} · Foto {String(photoIndex + 1).padStart(2, "0")}</Text><Text style={styles.photoMeta}>{getPhotoMeta(photo)}</Text><Text style={styles.photoNote}>{photo.note || photo.caption || "Sem observações adicionais"}</Text></View></View>)}</View> : <View style={styles.noPhotoRow}><IconSymbol name="photo.fill" size={17} color="#91A099" /><Text style={styles.emptyText}>Nenhuma foto neste ambiente.</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F8F4" },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  loadingText: { color: "#738078", fontSize: 13 },
  notFound: { color: "#1D2924", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  content: { padding: 20, paddingBottom: 36 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  topbarCopy: { flex: 1 },
  overline: { color: "#738078", fontSize: 10, letterSpacing: 1.1, fontWeight: "800" },
  topbarTitle: { color: "#1D2924", fontSize: 16, fontWeight: "800", marginTop: 2 },
  hero: { backgroundColor: "#203C31", borderRadius: 22, padding: 19, marginBottom: 12 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroDate: { color: "#AFCBBE", fontSize: 11 },
  heroTitle: { color: "#FFFFFF", fontSize: 23, lineHeight: 28, fontWeight: "800", marginTop: 19 },
  heroSubtitle: { color: "#D1E3D9", fontSize: 14, marginTop: 8 },
  heroLocation: { color: "#AFCBBE", fontSize: 12, marginTop: 4 },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "#446052", marginTop: 18, paddingTop: 13 },
  heroFooterText: { color: "#C4D7CD", fontSize: 11 },
  heroReady: { fontSize: 11, fontWeight: "800" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 26 },
  quickCard: { width: "48.5%", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 15, padding: 12 },
  quickIcon: { width: 29, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLabel: { color: "#738078", fontSize: 11 },
  quickValue: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 2 },
  reportBlock: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 17, padding: 15, marginBottom: 11 },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EEF2EF", marginBottom: 11 },
  blockTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800" },
  infoRow: { marginBottom: 10 },
  infoLabel: { color: "#8A958E", fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  infoValue: { color: "#314139", fontSize: 13, lineHeight: 19 },
  bodyText: { color: "#526159", fontSize: 13, lineHeight: 20, marginBottom: 13 },
  subLabel: { color: "#2E7D62", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  smallText: { color: "#738078", fontSize: 11, lineHeight: 17 },
  locationSummary: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 },
  locationSummaryCopy: { flex: 1 },
  locationValue: { color: "#2E7D62", fontSize: 14, fontWeight: "800" },
  sketchPreview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#F7F8F4", resizeMode: "contain" },
  projectDocumentReview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#F7F8F4", resizeMode: "contain", marginTop: 8 },
  entryAccessReview: { backgroundColor: "#FFF9ED", borderWidth: 1, borderColor: "#EAD9AF", borderRadius: 12, padding: 10, marginBottom: 10 },
  entryAttemptReviewPhoto: { width: "100%", height: 150, borderRadius: 10, backgroundColor: "#F1F5F2", resizeMode: "cover", marginBottom: 8 },
  riskBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 4 },
  riskDot: { width: 10, height: 10, borderRadius: 10 },
  riskTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  environmentList: { gap: 12, marginTop: 13, marginBottom: 14 },
  environmentCard: { backgroundColor: "#F7F8F4", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 14, padding: 12 },
  environmentHeader: { flexDirection: "row", alignItems: "center", gap: 9, paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#E5EBE6" },
  environmentNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#E0EEE6", alignItems: "center", justifyContent: "center" },
  environmentNumberText: { color: "#2E7D62", fontSize: 10, fontWeight: "800" },
  environmentHeaderCopy: { flex: 1 },
  environmentTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800" },
  environmentMeta: { color: "#738078", fontSize: 10, marginTop: 2 },
  photoList: { gap: 11, marginTop: 12 },
  photoRow: { flexDirection: "row", gap: 11, backgroundColor: "#F7F8F4", borderRadius: 13, padding: 8 },
  thumb: { width: 72, height: 72, borderRadius: 9, backgroundColor: "#E7EEE9" },
  photoRowCopy: { flex: 1, justifyContent: "center" },
  photoTitle: { color: "#1D2924", fontSize: 12, fontWeight: "800" },
  photoMeta: { color: "#2E7D62", fontSize: 10, marginTop: 3 },
  photoNote: { color: "#738078", fontSize: 11, lineHeight: 15, marginTop: 4 },
  noPhotoRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#D7E2DA", borderRadius: 10 },
  emptyText: { color: "#8A958E", fontSize: 12 },
  disclaimer: { color: "#8A958E", fontSize: 10, lineHeight: 15, borderTopWidth: 1, borderTopColor: "#EEF2EF", paddingTop: 11, marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14 },
  footerText: { color: "#8A958E", fontSize: 11 },
});

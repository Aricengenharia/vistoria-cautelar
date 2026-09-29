import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InspectionStatus } from "../shared/inspection-workflow";

export type { InspectionStatus } from "../shared/inspection-workflow";

export type PropertyType = "Casa" | "Apartamento" | "Área comum" | "Prédio" | "Comércio" | "Outro";
export type VulnerabilityLevel = "Baixa" | "Média" | "Alta";

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

export type InspectionPhoto = {
  id: string;
  uri: string;
  caption: string;
  environment: string;
  note: string;
  latitude?: number;
  longitude?: number;
  takenAt: string;
};

export type EnvironmentDetail = {
  observations: string;
  finishes: string;
  pathologies: string;
  checklist: Record<string, ExternalChecklistItem>;
  electricalInstallations: string;
  hydraulicInstallations: string;
};

export type ExternalChecklistItem = {
  material: string[];
  pathology: string[];
};

export type ExternalArea = {
  enabled: boolean;
  items: Record<string, ExternalChecklistItem>;
  observations: string;
};

export type EntryAttempt = {
  date: string;
  time: string;
  photoUri: string;
};

export type EntryAccess = {
  status: string;
  attempts: EntryAttempt[];
};

export type Inspection = {
  id: string;
  serverId?: number;
  code: string;
  createdAt: string;
  updatedAt: string;
  status: InspectionStatus;
  inspectorName: string;
  reviewerName: string;
  approverName: string;
  property: {
    ownerName: string;
    workName: string;
    inspectionDate: string;
    sequentialCode: string;
    address: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    propertyType: PropertyType;
    cep: string;
    complement: string;
    occupancyType: string;
    establishmentName: string;
    garagePossession: string;
    garageSpaces: string;
    undergroundInterferences: string[];
    normalWellDepth: string;
    artesianWellDepth: string;
    undergroundOther: string;
    additionalInformation: string;
    occupancy: string;
    year: string;
    floors: string;
    approximateAge: string;
    lastRenovationAge: string;
    buildingType: string;
    situation: string;
    garage: string;
    propertyFloors: string;
    propertyFloorsOther: string;
    basements: string;
    totalBuildingFloors: string;
    totalBuildingFloorsOther: string;
    builtArea: string;
    referenceDocs: string;
  };
  description: string;
  methodNotes: string;
  location: GeoPoint | null;
  environments: string[];
  environmentDetails: Record<string, EnvironmentDetail>;
  finishes: string;
  pathologies: string;
  vulnerabilityLevel: VulnerabilityLevel;
  vulnerabilityScore: number;
  conservation: string;
  constructionStandard: string;
  structureType: string;
  roofType: string;
  questionnaire: {
    occupantName: string;
    priorWorks: string;
    priorCracks: string;
    observedVibration: string;
    comments: string;
  };
  opinion: string;
  photos: InspectionPhoto[];
  sketch: { mode: "none" | "draw" | "image"; uri: string; strokes: string[] };
  externalArea: ExternalArea;
  occupantSurvey: Record<string, string>;
  projectDocumentUri: string;
  entryAccess: EntryAccess;
  signatures: { responsible: string[]; occupant: string[] };
  internalChecklist: Record<string, ExternalChecklistItem>;
};

const STORAGE_KEY = "vistoria-cautelar:inspections:v1";

export function emptyEnvironmentDetail(): EnvironmentDetail {
  return { observations: "", finishes: "", pathologies: "", checklist: {}, electricalInstallations: "", hydraulicInstallations: "" };
}

export function emptyExternalArea(): ExternalArea {
  return { enabled: false, items: {}, observations: "" };
}

export function emptyEntryAccess(): EntryAccess {
  return { status: "", attempts: [1, 2, 3].map(() => ({ date: "", time: "", photoUri: "" })) };
}

export function normalizeInspectionStatus(status: unknown): InspectionStatus {
  if (status === "Rascunho") return "Em elaboração";
  if (status === "Concluída") return "Concluído";
  return status === "Concluído" || status === "Conferido" || status === "Aprovado" ? status : "Em elaboração";
}

export function normalizeInspection(item: Inspection): Inspection {
  const environmentDetails = { ...(item.environmentDetails ?? {}) };
  for (const environment of item.environments ?? []) {
    environmentDetails[environment] = {
      ...emptyEnvironmentDetail(),
      ...(environmentDetails[environment] ?? {}),
    };
  }
  return {
    ...item,
    status: normalizeInspectionStatus((item as Partial<Inspection>).status),
    inspectorName: item.inspectorName ?? "",
    reviewerName: item.reviewerName ?? "",
    approverName: item.approverName ?? "",
    serverId: item.serverId ? Number(item.serverId) : undefined,
    property: Object.assign({
      ownerName: "", workName: "", inspectionDate: new Date().toISOString().slice(0, 10), sequentialCode: "", address: "", number: "", neighborhood: "", city: "", state: "SP", propertyType: "Casa", cep: "", complement: "", occupancyType: "", establishmentName: "", garagePossession: "", garageSpaces: "", undergroundInterferences: [], normalWellDepth: "", artesianWellDepth: "", undergroundOther: "", additionalInformation: "", occupancy: "", year: "", floors: "", approximateAge: "", lastRenovationAge: "", buildingType: "", situation: "", garage: "", propertyFloors: "", propertyFloorsOther: "", basements: "", totalBuildingFloors: "", totalBuildingFloorsOther: "", builtArea: "", referenceDocs: "",
    }, { ...(item.property ?? {}), undergroundInterferences: item.property?.undergroundInterferences ?? [] }),
    environments: item.environments ?? [],
    environmentDetails,
    photos: item.photos ?? [],
    conservation: item.conservation ?? "",
    constructionStandard: item.constructionStandard ?? "",
    structureType: item.structureType ?? "",
    roofType: item.roofType ?? "",
    vulnerabilityScore: item.vulnerabilityScore ?? 0,
    sketch: Object.assign({ mode: "none" as const, uri: "", strokes: [] as string[] }, item.sketch ?? {}),
    externalArea: { ...emptyExternalArea(), ...(item.externalArea ?? {}), items: item.externalArea?.items ?? {} },
    occupantSurvey: item.occupantSurvey ?? {},
    projectDocumentUri: item.projectDocumentUri ?? "",
    entryAccess: {
      ...emptyEntryAccess(),
      ...(item.entryAccess ?? {}),
      attempts: [0, 1, 2].map((index) => ({ ...emptyEntryAccess().attempts[index], ...(item.entryAccess?.attempts?.[index] ?? {}) })),
    },
    signatures: Object.assign({ responsible: [] as string[], occupant: [] as string[] }, item.signatures ?? {}),
    internalChecklist: item.internalChecklist ?? {},
  };
}

export async function listInspections(): Promise<Inspection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Inspection[]).map(normalizeInspection).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function saveInspection(inspection: Inspection): Promise<void> {
  const items = await listInspections();
  const next = [inspection, ...items.filter((item) => item.id !== inspection.id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export type RemoteInspectionRecord = {
  id: number;
  ownerUserId: number;
  sequentialCode: string;
  status: InspectionStatus;
  propertyAddress: string;
  propertyType: string | null;
  payload: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export function fromRemoteInspection(record: RemoteInspectionRecord): Inspection {
  const fallback = createInspection();
  const payload = record.payload && typeof record.payload === "object" ? record.payload as Partial<Inspection> : {};
  const payloadProperty = payload.property ?? fallback.property;
  return normalizeInspection({
    ...fallback,
    ...payload,
    id: payload.id || `server-${record.id}`,
    serverId: record.id,
    code: record.sequentialCode,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    status: record.status,
    property: {
      ...fallback.property,
      ...payloadProperty,
      address: record.propertyAddress || payloadProperty.address,
      propertyType: (record.propertyType || payloadProperty.propertyType) as PropertyType,
      sequentialCode: record.sequentialCode,
    },
  });
}

export function mergeLocalAndRemoteInspections(local: Inspection[], remote: Inspection[]): Inspection[] {
  const merged = new Map<string, Inspection>();
  for (const item of [...local, ...remote]) {
    const key = item.serverId ? `server:${item.serverId}` : `local:${item.id}`;
    const current = merged.get(key);
    if (!current || item.updatedAt >= current.updatedAt) merged.set(key, item);
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createInspection(): Inspection {
  const now = new Date().toISOString();
  const stamp = now.replace(/[-:TZ.]/g, "").slice(0, 12);
  return {
    id: `inspection-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    code: `VC-${stamp}`,
    createdAt: now,
    updatedAt: now,
    status: "Em elaboração",
    inspectorName: "",
    reviewerName: "",
    approverName: "",
    property: {
      ownerName: "", address: "", number: "", neighborhood: "", city: "", state: "SP",
      propertyType: "Casa", workName: "", inspectionDate: now.slice(0, 10), sequentialCode: "", cep: "", complement: "", occupancyType: "", establishmentName: "", garagePossession: "", garageSpaces: "", undergroundInterferences: [], normalWellDepth: "", artesianWellDepth: "", undergroundOther: "", additionalInformation: "", occupancy: "", year: "", floors: "", approximateAge: "", lastRenovationAge: "", buildingType: "", situation: "", garage: "", propertyFloors: "", propertyFloorsOther: "", basements: "", totalBuildingFloors: "", totalBuildingFloorsOther: "", builtArea: "", referenceDocs: "",
    },
    description: "",
    methodNotes: "Inspeção visual das áreas com acesso permitido, com registro das características construtivas, estado de conservação e eventuais anomalias observadas.",
    location: null,
    environments: [],
    environmentDetails: {},
    finishes: "",
    pathologies: "",
    vulnerabilityLevel: "Baixa",
    vulnerabilityScore: 0,
    conservation: "",
    constructionStandard: "",
    structureType: "",
    roofType: "",
    questionnaire: { occupantName: "", priorWorks: "", priorCracks: "", observedVibration: "", comments: "" },
    opinion: "",
    photos: [],
    sketch: { mode: "none", uri: "", strokes: [] },
    externalArea: emptyExternalArea(),
    occupantSurvey: {},
    projectDocumentUri: "",
    entryAccess: emptyEntryAccess(),
    signatures: { responsible: [], occupant: [] },
    internalChecklist: {},
  };
}

export const ENVIRONMENTS = ["Fachada", "Sala", "Cozinha", "Banheiro", "Quarto", "Área externa", "Área comum", "Loja / salão", "Garagem"];
export const PROPERTY_TYPES: PropertyType[] = ["Casa", "Apartamento", "Área comum", "Prédio", "Comércio", "Outro"];
export const VULNERABILITY_LEVELS: VulnerabilityLevel[] = ["Baixa", "Média", "Alta"];

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function formatCoordinates(location: GeoPoint | null): string {
  return location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "Ainda não registrada";
}

export function vulnerabilityColor(level: VulnerabilityLevel): string {
  return level === "Alta" ? "#C2413B" : level === "Média" ? "#C98525" : "#2E7D62";
}

export function vulnerabilityCopy(level: VulnerabilityLevel): string {
  return level === "Alta" ? "Requer atenção e acompanhamento prioritário" : level === "Média" ? "Recomenda-se acompanhamento durante a obra" : "Sem indícios relevantes na inspeção visual";
}

export function inspectionProgress(inspection: Inspection): number {
  const checks = [Boolean(inspection.property.address), Boolean(inspection.location), inspection.environments.length > 0, inspection.photos.length > 0, Boolean(inspection.questionnaire.occupantName), Boolean(inspection.opinion)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function inspectionIsReady(inspection: Inspection): boolean {
  return Boolean(inspection.property.address && inspection.location && inspection.photos.length > 0);
}

export function buildOpinion(inspection: Inspection): string {
  const place = inspection.property.address || "o imóvel vistoriado";
  return `Com base na inspeção visual realizada em ${place}, nas áreas em que foi permitido o acesso, registram-se as condições observadas no presente cadastro. A classificação preliminar indica ${vulnerabilityCopy(inspection.vulnerabilityLevel).toLowerCase()}. Este parecer não substitui avaliação estrutural, ensaios ou análise de capacidade de carga.`;
}

export function getPropertyLabel(item: Inspection): string {
  return item.property.address || "Endereço não informado";
}

export function getCityLabel(item: Inspection): string {
  return [item.property.neighborhood, item.property.city, item.property.state].filter(Boolean).join(" · ") || "Local não informado";
}

export function getEssentialCopy(item: Inspection): string {
  const missing = [!item.property.address && "endereço", !item.location && "localização GPS", !item.photos.length && "fotos"].filter(Boolean);
  return missing.length ? `Falta registrar: ${missing.join(", ")}.` : "Todos os itens essenciais foram registrados.";
}

export function getQuestionnaireStatus(item: Inspection): string {
  return item.questionnaire.occupantName ? "Questionário respondido" : "Questionário pendente";
}

export function getPhotoMeta(photo: InspectionPhoto): string {
  return `${photo.environment || "Ambiente não informado"} · ${formatDate(photo.takenAt)}`;
}

export function makeEmptyPhoto(index: number): InspectionPhoto {
  return { id: `photo-${Date.now()}-${index}`, uri: "", caption: `Registro ${String(index).padStart(2, "0")}`, environment: "Fachada", note: "", takenAt: new Date().toISOString() };
}

export const REPORT_SECTIONS = ["Ficha técnica de campo", "Descrição sucinta do imóvel", "Dados gerais do imóvel", "Localização do imóvel", "Acabamentos e patologias", "Índice de vulnerabilidade", "Relatório fotográfico", "Questionário do ocupante", "Parecer"];

export function cloneInspection(item: Inspection): Inspection {
  return JSON.parse(JSON.stringify(item)) as Inspection;
}

export function markUpdated(item: Inspection): Inspection {
  return { ...item, updatedAt: new Date().toISOString() };
}

export function getSectionCount(item: Inspection): number {
  const hasEnvironmentDetails = Object.values(item.environmentDetails ?? {}).some((detail) => detail.observations || detail.finishes || detail.pathologies);
  return [item.property.address, item.description, item.location, item.finishes || item.pathologies || hasEnvironmentDetails, item.photos.length, item.questionnaire.occupantName, item.opinion].filter(Boolean).length;
}

export function summarizeInspections(items: Inspection[]) {
  return {
    total: items.length,
    drafts: items.filter((item) => item.status === "Em elaboração").length,
    completed: items.filter((item) => item.status === "Concluído").length,
    elaborating: items.filter((item) => item.status === "Em elaboração").length,
    concluded: items.filter((item) => item.status === "Concluído").length,
    reviewed: items.filter((item) => item.status === "Conferido").length,
    approved: items.filter((item) => item.status === "Aprovado").length,
    photos: items.reduce((sum, item) => sum + item.photos.length, 0),
  };
}

export function getInspectionStatusColor(status: InspectionStatus): string {
  return status === "Aprovado" ? "#267143" : status === "Conferido" ? "#5D7290" : status === "Concluído" ? "#2E7D62" : "#C98525";
}

export function getStatusLabel(status: InspectionStatus): string {
  return status;
}

export function getSectionStatus(value: unknown): string {
  return value ? "Preenchido" : "Pendente";
}

export function getReportTitle(item: Inspection): string {
  return `Relatório técnico · ${item.code}`;
}

export function getReportSubtitle(item: Inspection): string {
  return `${item.property.propertyType} · ${item.property.city || "Local não informado"}`;
}

export function getAddressLabel(item: Inspection): string {
  return `${item.property.address || "Endereço não informado"}${item.property.number ? `, ${item.property.number}` : ""}`;
}

export function getOwnerLabel(item: Inspection): string {
  return item.property.ownerName || "Responsável não informado";
}

export function getLocationLabel(item: Inspection): string {
  return item.location ? "GPS registrado" : "GPS pendente";
}

export function getPhotoCountLabel(item: Inspection): string {
  return `${item.photos.length} ${item.photos.length === 1 ? "foto" : "fotos"}`;
}

export function getEnvironmentLabel(item: Inspection): string {
  return item.environments.length ? item.environments.join(" · ") : "Nenhum ambiente selecionado";
}

export function getReportStatusCopy(item: Inspection): string {
  return `${getStatusLabel(item.status)} · ${inspectionProgress(item)}% preenchido`;
}

export function getCoordinatesLabel(location: GeoPoint | null): string {
  return location ? `Lat ${location.latitude.toFixed(5)} · Long ${location.longitude.toFixed(5)}` : "Toque em registrar para capturar o ponto do imóvel";
}

export function getLocationAccuracy(location: GeoPoint | null): string {
  return location?.accuracy ? `Precisão ±${Math.round(location.accuracy)} m` : "Precisão não informada";
}

export function getOpinionStatus(item: Inspection): string {
  return item.opinion ? "Parecer preenchido" : "Parecer pendente";
}

export function getPathologyStatus(item: Inspection): string {
  const hasPathologies = item.pathologies || Object.values(item.environmentDetails ?? {}).some((detail) => detail.pathologies);
  return hasPathologies ? "Patologias descritas" : "Sem patologias descritas";
}

export function getDocumentStatus(item: Inspection): string {
  return item.property.referenceDocs ? "Referências anexadas" : "Sem documentos de referência";
}

export function getLastUpdated(item: Inspection): string {
  return `Atualizado em ${formatDate(item.updatedAt)}`;
}

export function getReportReadiness(item: Inspection): string {
  return inspectionIsReady(item) ? "Base pronta para relatório" : "Complete os itens essenciais";
}

export function getReportReadinessColor(item: Inspection): string {
  return inspectionIsReady(item) ? "#2E7D62" : "#C98525";
}

export function newPhotoCaption(index: number): string {
  return `Foto ${String(index).padStart(2, "0")}`;
}

export function isValidCoordinate(location: GeoPoint | null): boolean {
  return Boolean(location && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180);
}

export function getInspectionSummary(item: Inspection): string {
  return `${item.code} · ${item.photos.length} fotos · ${item.environments.length} ambientes`;
}

export function getPhotoLocation(photo: InspectionPhoto): string {
  return photo.latitude && photo.longitude ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}` : "Localização não anexada";
}

export function getPhotoDescription(photo: InspectionPhoto): string {
  return photo.note || "Sem observações adicionais";
}

export function getAnswer(value: string): string {
  return value || "Não informado";
}

export function getReportDisclaimer(): string {
  return "As informações são provenientes de constatação visual nos locais em que o acesso foi permitido e não substituem ensaios ou análise estrutural.";
}

export function getReportIntro(): string {
  return "Registro digital alinhado ao modelo de vistoria cautelar fornecido.";
}

export function getReportMethodIntro(): string {
  return "A vistoria caracteriza a situação física aparente do imóvel, registrando tipologia, aspectos construtivos, conservação e anomalias visíveis.";
}

export function getReportPhotoIntro(): string {
  return "As imagens integram o relatório fotográfico e recebem ambiente, data e coordenadas quando disponíveis.";
}

export function getReportQuestionnaireIntro(): string {
  return "Informações declaradas pelo ocupante ou acompanhante da vistoria.";
}

export function getReportOpinionIntro(): string {
  return "Síntese preliminar baseada nos registros do formulário.";
}

export function getReportLocationIntro(): string {
  return "Ponto capturado pelo dispositivo no momento da vistoria.";
}

export function getReportVulnerabilityIntro(): string {
  return "Classificação preliminar para orientar acompanhamento durante a obra.";
}

export function getReportPropertyIntro(): string {
  return "Dados gerais informados para identificação do imóvel.";
}

export function getReportFinishesIntro(): string {
  return "Acabamentos e patologias identificados durante a inspeção visual.";
}

export function getReportGeneratedCopy(): string {
  return "Gerado a partir dos dados coletados em campo.";
}

export function getReportSectionLabel(index: number): string {
  return REPORT_SECTIONS[index] || "Seção do relatório";
}

export function getReportPhotoLabel(index: number): string {
  return `Foto ${String(index + 1).padStart(2, "0")}`;
}

export function getReportPhotoMeta(photo: InspectionPhoto): string {
  return getPhotoMeta(photo);
}

export function getReportPhotoNote(photo: InspectionPhoto): string {
  return getPhotoDescription(photo);
}

export function getReportPhotoLocation(photo: InspectionPhoto): string {
  return getPhotoLocation(photo);
}

export function getReportReadyCopy(item: Inspection): string {
  return inspectionIsReady(item) ? "Os itens essenciais foram registrados." : getEssentialCopy(item);
}

export function getReportVulnerability(item: Inspection): string {
  return `${item.vulnerabilityLevel} · ${vulnerabilityCopy(item.vulnerabilityLevel)}`;
}

export function getReportLocation(item: Inspection): string {
  return formatCoordinates(item.location);
}

export function getReportQuestionnaire(item: Inspection): string {
  return item.questionnaire.occupantName ? "Questionário respondido" : "Questionário não respondido";
}

export function getReportOpinion(item: Inspection): string {
  return item.opinion || buildOpinion(item);
}

export function getReportPathologies(item: Inspection): string {
  const perEnvironment = item.environments
    .map((environment) => {
      const value = item.environmentDetails?.[environment]?.pathologies?.trim();
      return value ? `${environment}: ${value}` : "";
    })
    .filter(Boolean);
  return [item.pathologies, ...perEnvironment].filter(Boolean).join("\n") || "Nenhuma patologia descrita no formulário.";
}

export function getReportFinishes(item: Inspection): string {
  const perEnvironment = item.environments
    .map((environment) => {
      const value = item.environmentDetails?.[environment]?.finishes?.trim();
      return value ? `${environment}: ${value}` : "";
    })
    .filter(Boolean);
  return [item.finishes, ...perEnvironment].filter(Boolean).join("\n") || "Nenhum acabamento descrito no formulário.";
}

export function getReportDescription(item: Inspection): string {
  return item.description || "Nenhuma descrição adicional registrada.";
}

export function getReportMethod(item: Inspection): string {
  return item.methodNotes || "Metodologia não informada.";
}

export function getReportPhotoSummary(item: Inspection): string {
  return `${item.photos.length} registros fotográficos`;
}

export function getReportEnvironmentSummary(item: Inspection): string {
  return getEnvironmentLabel(item);
}

export function getReportSectionCount(item: Inspection): string {
  return `${getSectionCount(item)} de ${REPORT_SECTIONS.length} seções com dados`;
}

export function getReportFooter(item: Inspection): string {
  return `Documento de campo · ${item.code} · ${formatDate(item.updatedAt)}`;
}

export function getReportHeaderTitle(): string {
  return "RELATÓRIO TÉCNICO · VISTORIA CAUTELAR";
}

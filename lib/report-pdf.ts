import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Inspection, formatDate, getAddressLabel, getReportOpinion } from "./inspection-storage";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Não informado";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, child]) => `${key}: ${displayValue(child)}`).join(" · ");
  return String(value);
}

function safeDate(value: string): string {
  try { return formatDate(value); } catch { return value || "Não informado"; }
}

function field(label: string, value: unknown): string {
  return `<div class="field"><div class="label">${escapeHtml(label)}</div><div>${escapeHtml(displayValue(value))}</div></div>`;
}

function paragraph(label: string, value: unknown): string {
  return `<p><b>${escapeHtml(label)}:</b> ${escapeHtml(displayValue(value))}</p>`;
}

function checklistRows(items: Record<string, { material?: string[]; pathology?: string[] }> | undefined): string {
  const entries = Object.entries(items ?? {});
  if (!entries.length) return `<p class="muted">Nenhum item selecionado.</p>`;
  return `<div class="checkHeader"><b>Elemento</b><b>Material</b><b>Patologia / anomalia</b></div>${entries.map(([element, value]) => `<div class="checkRow"><b>${escapeHtml(element)}</b><span>${escapeHtml(displayValue(value.material))}</span><span>${escapeHtml(displayValue(value.pathology))}</span></div>`).join("")}`;
}

function drawingSegments(points: string[]): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];
  for (const point of points ?? []) {
    const starts = point.startsWith("S:");
    const clean = starts ? point.slice(2) : point;
    if (starts && current.length) { segments.push(current); current = []; }
    if (/^\d+(\.\d+)?,\d+(\.\d+)?$/.test(clean)) current.push(clean);
  }
  if (current.length) segments.push(current);
  return segments;
}

function segmentsSvg(points: string[], className: string): string {
  const lines = drawingSegments(points).map((segment) => {
    if (segment.length < 2) return "";
    return `<polyline points="${segment.join(" ")}" fill="none" stroke="#15241d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join("");
  return `<svg viewBox="0 0 700 420" preserveAspectRatio="none" class="${className}">${lines}</svg>`;
}

function signatureSvg(points: string[]): string {
  return drawingSegments(points).some((segment) => segment.length > 1) ? segmentsSvg(points, "signature") : "<span class=\"muted\">Assinatura não registrada</span>";
}

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

async function imageSource(uri: string): Promise<string> {
  if (!uri) return "";
  if (uri.startsWith("data:")) return uri;
  try {
    if (Platform.OS === "web" || uri.startsWith("blob:") || uri.startsWith("http")) {
      const response = await fetch(uri);
      return await blobToDataUri(await response.blob());
    }
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return "";
  }
}

const surveyLabels: Record<string, string> = {
  "IPTU-present": "IPTU disponível",
  "IPTU-number": "Número do contribuinte",
  "IPTU-copy": "IPTU pode ser copiado",
  "Matrícula no Registro de Imóveis-present": "Matrícula disponível",
  "Matrícula no Registro de Imóveis-number": "Número de matrícula",
  "Matrícula no Registro de Imóveis-copy": "Matrícula pode ser copiada",
  "Habite-se ou Auto de Conclusão-present": "Habite-se / Auto de conclusão disponível",
  "Habite-se ou Auto de Conclusão-number": "Número e data do Habite-se",
  "Habite-se ou Auto de Conclusão-copy": "Habite-se pode ser copiado",
  "Projeto ou Planta aprovada pela Prefeitura-present": "Projeto ou planta disponível",
  "Projeto ou Planta aprovada pela Prefeitura-number": "Número e data do projeto",
  "Projeto ou Planta aprovada pela Prefeitura-copy": "Projeto pode ser copiado",
  "Conta de Energia ou Luz-present": "Conta de energia disponível",
  "Conta de Energia ou Luz-number": "Número da instalação / medidor",
  "Conta de Energia ou Luz-copy": "Conta de energia pode ser copiada",
  "Conta de Água e Esgoto-present": "Conta de água disponível",
  "Conta de Água e Esgoto-number": "Número da instalação / hidrômetro",
  "Conta de Água e Esgoto-copy": "Conta de água pode ser copiada",
  "Alvará de Funcionamento-present": "Alvará de funcionamento disponível",
  "Alvará de Funcionamento-number": "Número e data do alvará",
  "Alvará de Funcionamento-copy": "Alvará pode ser copiado",
  occupants: "Ocupantes do imóvel",
  buildYear: "Ano de construção",
  renovated: "Imóvel reformado",
  renovationCount: "Quantidade de reformas",
  lastRenovationYear: "Ano da última reforma",
  foundationKnown: "Tipo de fundação conhecido",
  foundationType: "Tipo de fundação",
  anomalies: "Anomalias significativas / reclamações",
  projects: "Projetos disponíveis",
  responsible: "Responsável pelas informações — nome / RG",
  completed: "Questionário entregue",
};

const hiddenSurveyPrefixes = ["Matrícula no Registro de Imóveis", "Habite-se ou Auto de Conclusão", "Conta de Energia ou Luz", "Alvará de Funcionamento", "Projeto ou Planta aprovada pela Prefeitura"];

function surveyHtml(survey: Record<string, string>): string {
  const entries = Object.entries(survey).filter(([key]) => !hiddenSurveyPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}-`)));
  if (!entries.length) return `<p class="muted">Questionário não preenchido.</p>`;
  return `<div class="grid">${entries.map(([key, value]) => field(surveyLabels[key] || key, value)).join("")}</div>`;
}

function photoMarkup(photo: Inspection["photos"][number], source: string, index: number): string {
  const image = source ? `<img src="${source}" />` : `<div class="photoMissing">Imagem indisponível</div>`;
  const gps = photo.latitude !== undefined && photo.longitude !== undefined ? ` · GPS ${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}` : "";
  return `<div class="photo"><div class="photoImage">${image}</div><div class="photoCopy"><b>${escapeHtml(photo.environment)} · Foto ${String(index + 1).padStart(2, "0")}</b>${paragraph("Legenda", photo.caption)}${paragraph("Observação", photo.note)}<p class="muted">Registrada em ${escapeHtml(safeDate(photo.takenAt))}${escapeHtml(gps)}</p></div></div>`;
}

export async function buildInspectionReportHtml(item: Inspection): Promise<string> {
  const imageSources = await Promise.all(item.photos.map((photo) => imageSource(photo.uri)));
  const photoMarkupById = new Map(item.photos.map((photo, index) => [photo.id, photoMarkup(photo, imageSources[index], index)]));
  const sketchImage = item.sketch.mode === "image" ? await imageSource(item.sketch.uri) : "";
  const sketchHtml = drawingSegments(item.sketch.strokes).some((segment) => segment.length > 1) ? `<div class="sketch">${segmentsSvg(item.sketch.strokes, "sketchSvg")}</div>` : sketchImage ? `<div class="sketch"><img class="sketchImage" src="${sketchImage}" /></div>` : `<div class="emptyBox">Croqui não registrado.</div>`;
  const projectDocumentImage = item.projectDocumentUri ? await imageSource(item.projectDocumentUri) : "";
  const entryAttemptHtml = item.entryAccess.status === "Não foi possível"
    ? (await Promise.all(item.entryAccess.attempts.map(async (attempt, index) => {
      const source = attempt.photoUri ? await imageSource(attempt.photoUri) : "";
      return `<div class="entryAttempt"><h3>${index + 1}ª tentativa de entrada</h3>${paragraph("Data", attempt.date)}${paragraph("Horário", attempt.time)}${source ? `<img class="entryAttemptImage" src="${source}" />` : `<p class="muted">Nenhuma foto registrada.</p>`}</div>`;
    }))).join("")
    : "";
  const entryAccessHtml = item.entryAccess.status === "Não foi possível"
    ? `<div class="entryAccessBlock">${paragraph("Resultado", "Vistoria não realizada: entrada não autorizada.")}${entryAttemptHtml}</div>`
    : paragraph("Autorização de entrada", item.entryAccess.status || "Não informado");
  const technicalFields = ([
    ["Obra", item.property.workName], ["Código sequencial", item.property.sequentialCode || item.code], ["Data da vistoria", item.property.inspectionDate || item.createdAt],
    ["Responsável / proprietário", item.property.ownerName], ["Endereço", getAddressLabel(item)], ["Bairro", item.property.neighborhood], ["Cidade", item.property.city], ["Estado", item.property.state], ["CEP", item.property.cep], ["Complemento", item.property.complement],
    ["Tipo de imóvel", item.property.propertyType], ["Tipo de ocupação", item.property.occupancyType], ["Ocupação / outra descrição", item.property.occupancy], ["Nome do estabelecimento", item.property.establishmentName], ["Tipo de edificação", item.property.buildingType], ["Situação", item.property.situation],
    ["Idade aproximada", item.property.approximateAge], ["Idade da última reforma", item.property.lastRenovationAge], ["Garagem", `${item.property.garagePossession || item.property.garage || ""} ${item.property.garageSpaces || ""}`.trim()], ["Pavimentos do imóvel", `${item.property.propertyFloors || ""} ${item.property.propertyFloorsOther || ""}`.trim()], ["Subsolos", item.property.basements], ["Total de pavimentos", `${item.property.totalBuildingFloors || ""} ${item.property.totalBuildingFloorsOther || ""}`.trim()], ["Área construída", item.property.builtArea],
    ["Interferências subterrâneas", item.property.undergroundInterferences], ["Profundidade do poço normal", item.property.normalWellDepth], ["Profundidade do poço artesiano", item.property.artesianWellDepth], ["Outra interferência subterrânea", item.property.undergroundOther], ["Documentos de referência", item.property.referenceDocs], ["Informações adicionais", item.property.additionalInformation],
  ] as Array<[string, unknown]>).map(([label, value]) => field(label, value)).join("");
  const photoByEnvironment = (environment: string) => item.photos.filter((photo) => photo.environment === environment).map((photo) => photoMarkupById.get(photo.id) || "").join("");
  const environmentHtml = item.environments.length ? item.environments.map((environment) => {
    const detail = item.environmentDetails?.[environment];
    return `<section class="environment"><h3>${escapeHtml(environment)}</h3>${checklistRows(detail?.checklist)}${paragraph("Instalações elétricas", detail?.electricalInstallations)}${paragraph("Instalações hidráulicas", detail?.hydraulicInstallations)}${paragraph("Observações", detail?.observations)}${paragraph("Acabamentos", detail?.finishes)}${paragraph("Patologias / anomalias", detail?.pathologies)}<h4>Registros fotográficos</h4>${photoByEnvironment(environment) || `<p class="muted">Nenhuma foto neste ambiente.</p>`}</section>`;
  }).join("") : `<p class="muted">Nenhum ambiente registrado.</p>`;
  const externalPhotos = photoByEnvironment("Área externa");
  const externalHtml = `${paragraph("Status", item.externalArea.enabled ? "Área externa vistoriada" : "Área externa não vistoriada")}${paragraph("Observações", item.externalArea.observations)}${item.externalArea.enabled ? checklistRows(item.externalArea.items) : ""}${externalPhotos ? `<h4>Registros fotográficos da área externa</h4>${externalPhotos}` : ""}`;
  const globalInternalHtml = Object.keys(item.internalChecklist ?? {}).length ? `<h3>Checklist interno geral</h3>${checklistRows(item.internalChecklist)}` : "";
  const vulnerabilityHtml = `${field("Classificação preliminar", item.vulnerabilityLevel)}${field("Pontuação", `${item.vulnerabilityScore} pontos`)}${field("Orientação", item.vulnerabilityLevel === "Alta" ? "Requer atenção e acompanhamento prioritário" : item.vulnerabilityLevel === "Média" ? "Recomenda-se acompanhamento durante a obra" : "Sem indícios relevantes na inspeção visual")}`;
  const projectDocumentHtml = `${paragraph("Projeto ou planta disponível", item.occupantSurvey["Projeto ou Planta aprovada pela Prefeitura-present"])}${paragraph("Número e data", item.occupantSurvey["Projeto ou Planta aprovada pela Prefeitura-number"])}${paragraph("Documento pode ser copiado", item.occupantSurvey["Projeto ou Planta aprovada pela Prefeitura-copy"])}${projectDocumentImage ? `<img class="documentImage" src="${projectDocumentImage}" />` : `<p class="muted">Nenhuma imagem do projeto ou planta anexada.</p>`}`;
  const questionHtml = `${entryAccessHtml}<h3>Projeto ou planta</h3>${projectDocumentHtml}${surveyHtml(item.occupantSurvey)}<h3>Relatos complementares</h3>${paragraph("Nome do ocupante / acompanhante", item.questionnaire.occupantName)}${paragraph("Obras anteriores", item.questionnaire.priorWorks)}${paragraph("Alterações realizadas na reforma", item.occupantSurvey.renovationChanges)}${paragraph("Trincas, fissuras ou danos prévios", item.questionnaire.priorCracks)}${paragraph("Vibração ou ruído anormal", item.questionnaire.observedVibration)}${paragraph("Comentários adicionais", item.questionnaire.comments)}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
@page{size:A4;margin:13mm 12mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,Helvetica,sans-serif;color:#24352d;font-size:10px;line-height:1.4;margin:0}h1{font-size:24px;margin:0 0 5px;color:#173429}h2{font-size:16px;color:#2e7d62;border-bottom:2px solid #d9e8dd;padding:0 0 6px;margin:0 0 10px;break-before:page;page-break-before:always;break-after:avoid;page-break-after:avoid}h2:first-of-type{break-before:auto;page-break-before:auto}h3{font-size:13px;color:#314139;margin:16px 0 7px;page-break-after:avoid}h4{font-size:10px;color:#2e7d62;text-transform:uppercase;letter-spacing:.5px;margin:13px 0 5px}.cover{border:1px solid #d9e8dd;border-radius:10px;padding:22px;margin-bottom:18px;background:#f7faf7}.coverTitle{font-size:11px;letter-spacing:1.5px;color:#2e7d62;font-weight:bold;text-transform:uppercase;margin-bottom:18px}.meta{color:#61746a;margin:4px 0}.grid{display:grid;grid-template-columns:1fr 1fr;column-gap:20px;row-gap:4px}.field{margin:5px 0;break-inside:avoid;page-break-inside:avoid}.label{font-size:8px;text-transform:uppercase;color:#809087;font-weight:bold;margin-bottom:2px}.muted{color:#7b8981}.emptyBox{border:1px dashed #b9d7c8;border-radius:7px;padding:20px;text-align:center;color:#7b8981}.locationBox{background:#eef7f0;border-left:4px solid #2e7d62;padding:10px;border-radius:4px}.checkHeader,.checkRow{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:8px;border-bottom:1px solid #e5eee8;padding:5px 4px;break-inside:avoid;page-break-inside:avoid}.checkHeader{background:#eef6f0;color:#2e7d62;font-size:8px;text-transform:uppercase}.checkRow span,.checkRow b{overflow-wrap:anywhere}.environment{border:1px solid #dfe9e1;border-radius:7px;padding:9px;margin:10px 0;break-inside:avoid;page-break-inside:avoid}.photo{display:flex;gap:10px;border-bottom:1px solid #e5eee8;padding:8px 0;break-inside:avoid;page-break-inside:avoid}.photoImage{width:125px;flex:0 0 125px}.photo img,.photoMissing{width:125px;height:88px;object-fit:cover;border-radius:5px;background:#edf2ee}.photoMissing{display:flex;align-items:center;justify-content:center;color:#7b8981;font-size:8px;text-align:center}.photoCopy{flex:1;min-width:0}.photoCopy p{margin:3px 0}.sketch{height:245px;border:1px solid #bfd7c6;border-radius:6px;background:#fff;overflow:hidden}.sketchSvg{width:100%;height:100%}.sketchImage{width:100%;height:100%;object-fit:contain}.documentImage{display:block;max-width:100%;max-height:360px;object-fit:contain;border:1px solid #bfd7c6;border-radius:6px;margin:9px 0}.entryAccessBlock{border:1px solid #ead9af;border-radius:7px;background:#fff9ed;padding:9px;break-inside:avoid;page-break-inside:avoid}.entryAttempt{border-top:1px solid #ead9af;padding-top:6px;margin-top:8px;break-inside:avoid;page-break-inside:avoid}.entryAttempt h3{color:#8a6519;margin:4px 0 6px}.entryAttemptImage{display:block;max-width:100%;max-height:260px;object-fit:contain;border-radius:5px;border:1px solid #e7dfc9;margin-top:6px}.signature{width:100%;height:115px}.signbox{display:inline-block;width:47%;vertical-align:top;margin-right:2%;break-inside:avoid;page-break-inside:avoid}.signbox .label{margin-top:6px}.signatureLine{border-bottom:1px solid #526159;margin-top:7px}.footer{border-top:1px solid #d9e8dd;margin-top:24px;padding-top:8px;color:#7b8981;font-size:9px}.pageBreak{break-before:page;page-break-before:always}
</style></head><body>
  <div class="cover"><div class="coverTitle">Vistoria Cautelar · Relatório Técnico</div><h1>${escapeHtml(item.property.workName || "Relatório de inspeção cautelar")}</h1><div class="meta"><b>Código:</b> ${escapeHtml(item.property.sequentialCode || item.code)}</div><div class="meta"><b>Status:</b> ${escapeHtml(item.status)}</div><div class="meta"><b>Vistoriador:</b> ${escapeHtml(item.inspectorName || "Não informado")}</div><div class="meta"><b>Conferido por:</b> ${escapeHtml(item.reviewerName || "Ainda não conferido")}</div><div class="meta"><b>Aprovado por:</b> ${escapeHtml(item.approverName || "Ainda não aprovado")}</div><div class="meta"><b>Data da vistoria:</b> ${escapeHtml(safeDate(item.property.inspectionDate || item.createdAt))}</div><div class="meta"><b>Imóvel:</b> ${escapeHtml(getAddressLabel(item))}</div></div>
<h2>1. Identificação do imóvel</h2><div class="grid">${technicalFields}</div>
<h2>2. Descrição e metodologia</h2>${paragraph("Descrição", item.description)}${paragraph("Metodologia e observações de acesso", item.methodNotes)}
<h2>3. Localização e georreferenciamento</h2><div class="locationBox">${item.location ? `<b>Coordenadas:</b> ${item.location.latitude.toFixed(6)}, ${item.location.longitude.toFixed(6)}<br/><b>Precisão aproximada:</b> ${item.location.accuracy ? `${Math.round(item.location.accuracy)} m` : "Não informada"}<br/><b>Capturada em:</b> ${escapeHtml(safeDate(item.location.capturedAt))}` : "Localização não registrada."}</div>
<h2>4. Croqui da planta do imóvel</h2>${sketchHtml}
<h2>5. Área externa</h2>${externalHtml}
<h2>6. Ambientes internos e registros fotográficos</h2>${environmentHtml}${globalInternalHtml}
<h2>7. Características construtivas</h2><div class="grid">${field("Estado de conservação", item.conservation)}${field("Padrão construtivo", item.constructionStandard)}${field("Tipo de estrutura", item.structureType)}${field("Tipo de cobertura", item.roofType)}${field("Acabamentos gerais", item.finishes)}${field("Patologias gerais", item.pathologies)}</div>
<h2>8. Índice de vulnerabilidade</h2><div class="grid">${vulnerabilityHtml}</div>
<h2>9. Questionário com o ocupante</h2>${questionHtml}
<h2>10. Parecer técnico</h2>${paragraph("Parecer preliminar", getReportOpinion(item))}${paragraph("Observação", "Este relatório registra as condições aparentes observadas no momento da vistoria, respeitando as áreas acessíveis e as informações fornecidas pelo ocupante.")}
<h2>11. Responsáveis pelo workflow</h2><div class="grid">${field("Vistoriador", item.inspectorName)}${field("Conferido por", item.reviewerName)}${field("Aprovado por", item.approverName)}</div><h2>12. Assinaturas</h2><div class="signbox"><div class="label">Responsável pelas informações</div>${signatureSvg(item.signatures.responsible)}<div class="signatureLine">Nome / assinatura</div></div><div class="signbox"><div class="label">Ocupante</div>${signatureSvg(item.signatures.occupant)}<div class="signatureLine">Nome / assinatura</div></div>
<div class="footer">Relatório gerado pelo sistema Vistoria Cautelar · ${escapeHtml(item.code)} · Documento para revisão e envio ao cliente.</div>
</body></html>`;
  return html;
}

export async function exportInspectionPdf(item: Inspection): Promise<string> {
  if (Platform.OS === "web") {
    await printWebReport(item);
    return "";
  }
  const html = await buildInspectionReportHtml(item);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Compartilhar relatório PDF", UTI: ".pdf" });
  return uri;
}

async function printWebReport(item: Inspection): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("A impressão web precisa ser iniciada em uma janela do navegador.");
  }
  const printWindow = window.open("", "_blank", "popup,width=1100,height=850");
  if (!printWindow) {
    throw new Error("O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o PDF completo.");
  }
  const html = await buildInspectionReportHtml(item);
  const title = `Relatório de vistoria ${item.property.sequentialCode || item.code}`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  await new Promise<void>((resolve) => {
    const startPrint = () => {
      printWindow.focus();
      printWindow.print();
      resolve();
    };
    if (printWindow.document.readyState === "complete") setTimeout(startPrint, 350);
    else printWindow.addEventListener("load", () => setTimeout(startPrint, 350), { once: true });
  });
}

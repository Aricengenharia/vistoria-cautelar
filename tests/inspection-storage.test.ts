import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  },
}));

import { buildOpinion, createInspection, formatCoordinates, fromRemoteInspection, getEssentialCopy, getReportFinishes, getReportPathologies, inspectionIsReady, inspectionProgress, listInspections, markUpdated, mergeLocalAndRemoteInspections, normalizeInspection, saveInspection, summarizeInspections, vulnerabilityColor } from "../lib/inspection-storage";

describe("inspection storage", () => {
  beforeEach(() => store.clear());

  it("creates a new inspection with the expected defaults", () => {
    const item = createInspection();
    expect(item.code).toMatch(/^VC-/);
    expect(item.status).toBe("Em elaboração");
    expect(item.location).toBeNull();
    expect(item.photos).toHaveLength(0);
    expect(item.property.propertyType).toBe("Casa");
    expect(item.projectDocumentUri).toBe("");
    expect(item.entryAccess.status).toBe("");
    expect(item.entryAccess.attempts).toHaveLength(3);
    expect(item.inspectorName).toBe("");
    expect(item.reviewerName).toBe("");
    expect(item.approverName).toBe("");
  });

  it("calculates progress and identifies essential missing data", () => {
    const item = createInspection();
    expect(inspectionProgress(item)).toBe(0);
    expect(inspectionIsReady(item)).toBe(false);
    expect(getEssentialCopy(item)).toContain("endereço");
    item.property.address = "Rua das Flores";
    item.location = { latitude: -23.55, longitude: -46.63, capturedAt: new Date().toISOString() };
    item.photos.push({ id: "p1", uri: "file://photo.jpg", caption: "Foto 01", environment: "Fachada", note: "", takenAt: new Date().toISOString() });
    expect(inspectionIsReady(item)).toBe(true);
    expect(inspectionProgress(item)).toBeGreaterThan(0);
    expect(getEssentialCopy(item)).toContain("Todos os itens essenciais");
  });

  it("saves and lists inspections locally", async () => {
    const item = markUpdated(createInspection());
    item.property.address = "Avenida Central, 100";
    await saveInspection(item);
    const items = await listInspections();
    expect(items).toHaveLength(1);
    expect(items[0].property.address).toBe("Avenida Central, 100");
  });

  it("summarizes drafts, completed items and photos", () => {
    const draft = createInspection();
    const completed = { ...createInspection(), status: "Concluído" as const, photos: [{ id: "p", uri: "file://p", caption: "Foto", environment: "Sala", note: "", takenAt: new Date().toISOString() }] };
    expect(summarizeInspections([draft, completed])).toEqual({ total: 2, drafts: 1, completed: 1, elaborating: 1, concluded: 1, reviewed: 0, approved: 0, photos: 1 });
  });

  it("builds technical helpers for coordinates and risk", () => {
    const item = createInspection();
    item.property.address = "Rua A";
    item.vulnerabilityLevel = "Alta";
    expect(vulnerabilityColor("Alta")).toBe("#C2413B");
    expect(formatCoordinates({ latitude: -23.55052, longitude: -46.63331, capturedAt: new Date().toISOString() })).toContain("-23.550520");
    expect(buildOpinion(item)).toContain("Rua A");
  });

  it("creates independent details for every selected environment", () => {
    const item = createInspection();
    item.environments = ["Sala", "Cozinha"];
    item.environmentDetails = {
      Sala: { observations: "Paredes conservadas", finishes: "Piso cerâmico", pathologies: "Fissura junto à janela", checklist: { Piso: { material: ["Cerâmico"], pathology: ["Trinca"] } }, electricalInstallations: "Tomadas conservadas", hydraulicInstallations: "Sem vazamentos" },
      Cozinha: { observations: "Uso normal", finishes: "Azulejo", pathologies: "Umidade junto à pia", checklist: {}, electricalInstallations: "", hydraulicInstallations: "" },
    };
    expect(getReportFinishes(item)).toContain("Sala: Piso cerâmico");
    expect(getReportFinishes(item)).toContain("Cozinha: Azulejo");
    expect(getReportPathologies(item)).toContain("Sala: Fissura junto à janela");
    expect(getReportPathologies(item)).toContain("Cozinha: Umidade junto à pia");
  });

  it("migrates previous records and preserves multiple photos in one environment", () => {
    const previous = createInspection();
    previous.environments = ["Fachada"];
    delete (previous as Partial<typeof previous>).environmentDetails;
    previous.photos = [
      { id: "p1", uri: "file://1.jpg", caption: "Foto 01", environment: "Fachada", note: "Vista geral", takenAt: new Date().toISOString() },
      { id: "p2", uri: "file://2.jpg", caption: "Foto 02", environment: "Fachada", note: "Detalhe da fissura", takenAt: new Date().toISOString() },
    ];
    const migrated = normalizeInspection(previous);
    expect(migrated.environmentDetails.Fachada).toEqual({ observations: "", finishes: "", pathologies: "", checklist: {}, electricalInstallations: "", hydraulicInstallations: "" });
    expect(migrated.photos.filter((photo) => photo.environment === "Fachada")).toHaveLength(2);
  });

  it("normalizes legacy report statuses to the current workflow", () => {
    const legacy = createInspection() as any;
    legacy.status = "Concluída";
    legacy.inspectorName = "Vistoriador de teste";
    legacy.reviewerName = "Conferente de teste";
    legacy.approverName = "Aprovador de teste";
    const migrated = normalizeInspection(legacy);
    expect(migrated.status).toBe("Concluído");
    expect(migrated.inspectorName).toBe("Vistoriador de teste");
    expect(migrated.reviewerName).toBe("Conferente de teste");
    expect(migrated.approverName).toBe("Aprovador de teste");
  });

  it("initializes and migrates the new form sections", () => {
    const item = createInspection();
    expect(item.sketch).toEqual({ mode: "none", uri: "", strokes: [] });
    expect(item.externalArea.enabled).toBe(false);
    expect(item.occupantSurvey).toEqual({});
    expect(item.signatures).toEqual({ responsible: [], occupant: [] });
    item.sketch = { mode: "draw", uri: "", strokes: ["10,20"] };
    item.signatures.responsible = ["10,20", "30,40"];
    item.externalArea = { enabled: true, items: { Piso: { material: ["Cerâmico"], pathology: ["Trinca"] } }, observations: "Área frontal" };
    const migrated = normalizeInspection(item);
    expect(migrated.sketch.strokes).toEqual(["10,20"]);
    expect(migrated.externalArea.items.Piso.material).toContain("Cerâmico");
    expect(migrated.signatures.responsible).toHaveLength(2);
    item.entryAccess = { status: "Não foi possível", attempts: [{ date: "29/09/2026", time: "08:00", photoUri: "foto-1" }] };
    const migratedEntry = normalizeInspection(item);
    expect(migratedEntry.entryAccess.attempts).toHaveLength(3);
    expect(migratedEntry.entryAccess.attempts[0]).toEqual({ date: "29/09/2026", time: "08:00", photoUri: "foto-1" });
    item.internalChecklist = { Parede: { material: ["Pintura"], pathology: ["Fissura"] } };
    expect(normalizeInspection(item).internalChecklist.Parede.material).toContain("Pintura");
    delete (item as Partial<typeof item>).projectDocumentUri;
    expect(normalizeInspection(item).projectDocumentUri).toBe("");
  });

  it("converts database records and keeps one item per server id", () => {
    const payload = createInspection();
    payload.property.address = "Endereço antigo";
    const remote = fromRemoteInspection({ id: 42, ownerUserId: 1, sequentialCode: "VC-2026-00042", status: "Concluído", propertyAddress: "Rua do Servidor, 42", propertyType: "Comércio", payload, createdAt: "2026-09-24T10:00:00.000Z", updatedAt: "2026-09-24T11:00:00.000Z" });
    expect(remote.serverId).toBe(42);
    expect(remote.code).toBe("VC-2026-00042");
    expect(remote.property.address).toBe("Rua do Servidor, 42");
    const stale = { ...remote, property: { ...remote.property, address: "Versão local" }, updatedAt: "2026-09-24T10:30:00.000Z" };
    const merged = mergeLocalAndRemoteInspections([stale], [remote]);
    expect(merged).toHaveLength(1);
    expect(merged[0].property.address).toBe("Rua do Servidor, 42");
  });
});

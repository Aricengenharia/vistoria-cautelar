import { describe, expect, it } from "vitest";
import { buildGalleryFolders, galleryAssetCount } from "../lib/gallery";
import { createInspection } from "../lib/inspection-storage";

describe("administrative gallery", () => {
  it("groups photos by environment and special media folders", () => {
    const item = createInspection();
    item.code = "VC-2026-00042";
    item.photos = [
      { id: "p1", uri: "https://example.com/sala.jpg", caption: "Vista da sala", environment: "Sala", note: "Parede norte", takenAt: "2026-09-29T10:00:00Z" },
      { id: "p2", uri: "https://example.com/sala-2.jpg", caption: "Detalhe", environment: "Sala", note: "Janela", takenAt: "2026-09-29T10:01:00Z" },
      { id: "p3", uri: "https://example.com/fachada.jpg", caption: "Fachada", environment: "Fachada", note: "Frontal", takenAt: "2026-09-29T10:02:00Z" },
    ];
    item.sketch = { mode: "image", uri: "https://example.com/croqui.png", strokes: [] };
    item.projectDocumentUri = "https://example.com/planta.jpg";
    item.entryAccess.attempts[0].photoUri = "https://example.com/entrada.jpg";
    const folders = buildGalleryFolders(item);
    expect(folders.map((folder) => folder.label)).toEqual(["Sala", "Fachada", "Croqui", "Projeto / planta", "Tentativas de entrada"]);
    expect(folders.find((folder) => folder.label === "Sala")?.assets).toHaveLength(2);
    expect(galleryAssetCount(item)).toBe(6);
  });

  it("ignores empty media references", () => {
    const item = createInspection();
    item.photos = [{ id: "empty", uri: "", caption: "", environment: "Sala", note: "", takenAt: "" }];
    expect(buildGalleryFolders(item)).toHaveLength(0);
  });
});

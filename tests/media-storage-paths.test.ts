import { describe, expect, it } from "vitest";
import { buildEntryAttemptStorageStem, buildInspectionStorageFolder, buildPhotoStorageStem, buildProjectStorageStem, buildSketchStorageStem } from "../lib/media-storage-paths";
import { createInspection } from "../lib/inspection-storage";

describe("media storage paths", () => {
  it("creates a stable folder for the inspection code", () => {
    const item = createInspection();
    item.code = "VC-2026-00042";
    expect(buildInspectionStorageFolder(item)).toBe("vc-2026-00042");
  });

  it("groups photos by environment and media type", () => {
    const item = createInspection();
    item.code = "VC-2026-00042";
    expect(buildPhotoStorageStem(item, { id: "foto 01", environment: "Sala de estar" })).toBe("vc-2026-00042/01-fotos/sala-de-estar/foto-01");
    expect(buildSketchStorageStem(item)).toBe("vc-2026-00042/02-croqui/croqui");
    expect(buildProjectStorageStem(item)).toBe("vc-2026-00042/03-projeto-planta/projeto-planta");
    expect(buildEntryAttemptStorageStem(item, 0)).toBe("vc-2026-00042/04-tentativas-entrada/tentativa-1");
  });
});

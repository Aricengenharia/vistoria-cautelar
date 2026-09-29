import type { Inspection, InspectionPhoto } from "./inspection-storage";

function slugSegment(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || fallback;
}

export function buildInspectionStorageFolder(item: Pick<Inspection, "id" | "serverId" | "code" | "property">): string {
  return slugSegment(item.property.sequentialCode || item.code || item.serverId || item.id, "vistoria");
}

export function buildPhotoStorageStem(item: Pick<Inspection, "id" | "serverId" | "code" | "property">, photo: Pick<InspectionPhoto, "id" | "environment">): string {
  const folder = buildInspectionStorageFolder(item);
  const environment = slugSegment(photo.environment, "geral");
  return `${folder}/01-fotos/${environment}/${slugSegment(photo.id, "foto")}`;
}

export function buildSketchStorageStem(item: Pick<Inspection, "id" | "serverId" | "code" | "property">): string {
  return `${buildInspectionStorageFolder(item)}/02-croqui/croqui`;
}

export function buildProjectStorageStem(item: Pick<Inspection, "id" | "serverId" | "code" | "property">): string {
  return `${buildInspectionStorageFolder(item)}/03-projeto-planta/projeto-planta`;
}

export function buildEntryAttemptStorageStem(item: Pick<Inspection, "id" | "serverId" | "code" | "property">, attemptIndex: number): string {
  return `${buildInspectionStorageFolder(item)}/04-tentativas-entrada/tentativa-${attemptIndex + 1}`;
}

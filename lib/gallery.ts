import type { Inspection, InspectionPhoto } from "./inspection-storage";

export type GalleryAsset = {
  id: string;
  uri: string;
  title: string;
  subtitle: string;
  kind: "photo" | "sketch" | "project" | "entry";
  takenAt?: string;
};

export type GalleryFolder = {
  key: string;
  label: string;
  description: string;
  assets: GalleryAsset[];
};

function environmentLabel(value: string): string {
  return value.trim() || "Geral";
}

function addPhoto(folder: GalleryFolder, photo: InspectionPhoto) {
  if (!photo.uri) return;
  folder.assets.push({
    id: photo.id,
    uri: photo.uri,
    title: photo.caption?.trim() || `Foto ${folder.assets.length + 1}`,
    subtitle: photo.note?.trim() || environmentLabel(photo.environment),
    kind: "photo",
    takenAt: photo.takenAt,
  });
}

export function buildGalleryFolders(item: Inspection): GalleryFolder[] {
  const folders = new Map<string, GalleryFolder>();
  const ensure = (key: string, label: string, description: string) => {
    const existing = folders.get(key);
    if (existing) return existing;
    const folder = { key, label, description, assets: [] } satisfies GalleryFolder;
    folders.set(key, folder);
    return folder;
  };

  for (const photo of item.photos) {
    const label = environmentLabel(photo.environment);
    addPhoto(ensure(`environment:${label}`, label, "Fotos registradas neste ambiente"), photo);
  }

  if (item.sketch.mode === "image" && item.sketch.uri) {
    ensure("sketch", "Croqui", "Imagem do croqui do imóvel").assets.push({ id: "sketch", uri: item.sketch.uri, title: "Croqui do imóvel", subtitle: "Croqui anexado", kind: "sketch" });
  }
  if (item.projectDocumentUri) {
    ensure("project", "Projeto / planta", "Imagem ou documento do projeto").assets.push({ id: "project", uri: item.projectDocumentUri, title: "Projeto ou planta", subtitle: "Documento anexado", kind: "project" });
  }
  item.entryAccess.attempts.forEach((attempt, index) => {
    if (!attempt.photoUri) return;
    ensure("entry", "Tentativas de entrada", "Fotos das tentativas de acesso").assets.push({ id: `entry-${index + 1}`, uri: attempt.photoUri, title: `Tentativa ${index + 1}`, subtitle: `${attempt.date || "Data não informada"} · ${attempt.time || "Horário não informado"}`, kind: "entry" });
  });

  return [...folders.values()].filter((folder) => folder.assets.length > 0);
}

export function galleryAssetCount(item: Inspection): number {
  return buildGalleryFolders(item).reduce((total, folder) => total + folder.assets.length, 0);
}

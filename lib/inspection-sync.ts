import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getApiBaseUrl } from "@/constants/oauth";
import type { Inspection } from "@/lib/inspection-storage";
import { buildEntryAttemptStorageStem, buildPhotoStorageStem, buildProjectStorageStem, buildSketchStorageStem } from "@/lib/media-storage-paths";

type UploadResult = { key: string; url: string };
type UploadMedia = (input: { fileName: string; mimeType: string; base64: string }) => Promise<UploadResult>;

function isStoredUri(uri: string) {
  return uri.startsWith("/manus-storage/") || uri.includes("/manus-storage/");
}

function extensionAndMime(uri: string) {
  const clean = uri.split("?")[0].toLowerCase();
  if (clean.endsWith(".png") || uri.startsWith("data:image/png")) return { extension: "png", mimeType: "image/png" };
  if (clean.endsWith(".webp") || uri.startsWith("data:image/webp")) return { extension: "webp", mimeType: "image/webp" };
  return { extension: "jpg", mimeType: "image/jpeg" };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(blob);
  });
}

async function uriToBase64(uri: string) {
  if (uri.startsWith("data:")) return uri.split(",")[1] || "";
  if (Platform.OS === "web") return blobToBase64(await (await fetch(uri)).blob());
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function absoluteStorageUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const apiBase = getApiBaseUrl();
  return apiBase ? `${apiBase}${url}` : url;
}

async function uploadUri(uri: string, fileStem: string, upload: UploadMedia) {
  if (!uri || isStoredUri(uri) || /^https?:\/\//.test(uri)) return uri;
  const { extension, mimeType } = extensionAndMime(uri);
  const result = await upload({ fileName: `${fileStem}.${extension}`, mimeType, base64: await uriToBase64(uri) });
  return absoluteStorageUrl(result.url);
}

export async function uploadInspectionMedia(item: Inspection, upload: UploadMedia): Promise<Inspection> {
  const photos = await Promise.all(item.photos.map(async (photo) => ({
    ...photo,
    uri: await uploadUri(photo.uri, buildPhotoStorageStem(item, photo), upload),
  })));
  const sketch = item.sketch.mode === "image" && item.sketch.uri
    ? { ...item.sketch, uri: await uploadUri(item.sketch.uri, buildSketchStorageStem(item), upload) }
    : item.sketch;
  const projectDocumentUri = item.projectDocumentUri
    ? await uploadUri(item.projectDocumentUri, buildProjectStorageStem(item), upload)
    : item.projectDocumentUri;
  const entryAccess = {
    ...item.entryAccess,
    attempts: await Promise.all(item.entryAccess.attempts.map(async (attempt, index) => ({
      ...attempt,
      photoUri: attempt.photoUri ? await uploadUri(attempt.photoUri, buildEntryAttemptStorageStem(item, index), upload) : attempt.photoUri,
    }))),
  };
  return { ...item, photos, sketch, projectDocumentUri, entryAccess };
}

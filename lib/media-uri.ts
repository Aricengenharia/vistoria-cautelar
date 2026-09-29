import { Platform } from "react-native";

export async function persistMediaUri(uri: string): Promise<string> {
  if (!uri || Platform.OS !== "web" || !uri.startsWith("blob:")) return uri;
  try {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result || uri));
      reader.readAsDataURL(blob);
    });
  } catch {
    return uri;
  }
}

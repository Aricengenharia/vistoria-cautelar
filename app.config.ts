import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const rawBundleId = "com.app.vistoriacautelar";
const bundleId = rawBundleId.replace(/[-_]/g, ".").replace(/[^a-zA-Z0-9.]/g, "").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "").toLowerCase();
const schemeFromBundleId = `manus${bundleId.split(".").pop() ?? "vistoria"}`;

const config: ExpoConfig = {
  name: "Vistoria Cautelar",
  slug: "vistoria-cautelar",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: schemeFromBundleId,
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "A câmera é usada para registrar as condições do imóvel.",
      NSPhotoLibraryUsageDescription: "A biblioteca é usada para anexar registros fotográficos da vistoria.",
      NSLocationWhenInUseUsageDescription: "A localização é usada para georreferenciar o imóvel vistoriado.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: bundleId,
    permissions: ["POST_NOTIFICATIONS", "CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    intentFilters: [{ action: "VIEW", autoVerify: true, data: [{ scheme: schemeFromBundleId, host: "*" }], category: ["BROWSABLE", "DEFAULT"] }],
  },
  web: { bundler: "metro", output: "static", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Permita que a Vistoria Cautelar use a câmera para registrar fotos do imóvel.",
      },
    ],
    "expo-audio",
    "expo-asset",
    "expo-font",
    "expo-image",
    "expo-secure-store",
    "expo-status-bar",
    "expo-video",
    "expo-web-browser",
    "expo-sharing",
    ["expo-image-picker", { photosPermission: "Permita o acesso para anexar registros fotográficos da vistoria.", cameraPermission: "Permita o acesso à câmera para registrar o imóvel." }],
    ["expo-location", { locationWhenInUsePermission: "Permita o acesso à localização para georreferenciar o imóvel vistoriado." }],
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#F7F8F4", dark: { backgroundColor: "#111714" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;

// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const env = {
  appName: "Ravvy",
  appSlug: "ravvy",
  scheme: "ravvy",
  iosBundleId: "com.ravvy.app",
  androidPackage: "com.ravvy.app",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  ios: {
    supportsTablet: false,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "1",
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "Ravvy utilise la caméra pour prendre des photos pour vos soirées.",
      NSPhotoLibraryUsageDescription: "Ravvy accède à vos photos pour les partager dans vos groupes.",
      NSPhotoLibraryAddUsageDescription: "Ravvy enregistre des photos dans votre galerie.",
      NSLocationWhenInUseUsageDescription: "Ravvy utilise votre position pour le partage de localisation en soirée.",
      NSMicrophoneUsageDescription: "Ravvy utilise le microphone pour les messages vocaux.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1A202C",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    versionCode: 1,
    permissions: [
      "POST_NOTIFICATIONS",
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECORD_AUDIO",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: env.scheme, host: "*" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
"expo-asset",
"expo-font",
"expo-image",
"expo-secure-store",
"expo-web-browser",
    "expo-router",
    "expo-apple-authentication",
    [
      "expo-audio",
      { microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone." },
    ],
    [
      "expo-video",
      { supportsBackgroundPlayback: true, supportsPictureInPicture: true },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: { backgroundColor: "#1A202C" },
      },
    ],
    [
  	"expo-build-properties",
 	 {
    		ios: {
      newArchEnabled: false,
    },
    android: {
      buildArchs: ["armeabi-v7a", "arm64-v8a"],
      minSdkVersion: 24,
      newArchEnabled: false,
    },
  },
],
  ],
extra: {
  eas: {
    projectId: "99e40705-e5e5-41b4-bcb8-db8c9803c985",
  },
},
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;

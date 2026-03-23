import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import * as WebBrowser from "expo-web-browser";

export type OAuthProvider = "email" | "apple" | "facebook" | "instagram";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.ravvy.t20260227052612";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // On web, always use relative URLs so that /api/* requests go through
  // the Metro dev proxy (port 8081 → 3000). API_BASE_URL is intentionally
  // ignored here: it targets native apps that have no proxy.
  if (ReactNative.Platform.OS === "web") {
    return "";
  }

  // On native, use the explicit base URL if provided
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // Native fallback: no base URL configured
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export class OAuthNotConfiguredError extends Error {
  constructor() {
    super(
      "EXPO_PUBLIC_OAUTH_PORTAL_URL n'est pas configuré.\n\n" +
        "Créez un fichier .env à la racine du projet en vous basant sur .env.example :\n\n" +
        "  cp .env.example .env\n\n" +
        "Puis renseignez les valeurs manquantes et relancez le serveur de développement.",
    );
    this.name = "OAuthNotConfiguredError";
  }
}

export const getLoginUrl = (provider?: OAuthProvider) => {
  if (!OAUTH_PORTAL_URL) {
    throw new OAuthNotConfiguredError();
  }

  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  if (provider && provider !== "email") {
    url.searchParams.set("provider", provider);
  }

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(provider?: OAuthProvider): Promise<string | null> {
  // getLoginUrl() throws OAuthNotConfiguredError if OAUTH_PORTAL_URL is missing —
  // let it propagate so callers can display a meaningful message.
  const loginUrl = getLoginUrl(provider);

  if (ReactNative.Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  // Social providers: in-app browser (SFSafariViewController / Chrome Custom Tab).
  // The redirect URL is returned directly, no deep link needed.
  if (provider && provider !== "email") {
    const redirectUri = getRedirectUri();
    const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);
    if (result.type === "success" && result.url) {
      return result.url;
    }
    return null;
  }

  // Email (default): open system browser, callback handled via deep link.
  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
  }

  return null;
}

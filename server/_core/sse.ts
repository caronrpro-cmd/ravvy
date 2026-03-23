import type { Response } from "express";

interface SseClient {
  userId: number;
  res: Response;
}

export interface LocationEntry {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

const chatClients = new Map<number, Set<SseClient>>();
const locationClients = new Map<number, Set<SseClient>>();
const refreshClients = new Map<number, Set<SseClient>>();

// Compteur de connexions SSE actives par userId (toutes channels confondues)
const sseConnectionsPerUser = new Map<number, number>();

export function getUserSseCount(userId: number): number {
  return sseConnectionsPerUser.get(userId) ?? 0;
}

function incrementSse(userId: number): void {
  sseConnectionsPerUser.set(userId, (sseConnectionsPerUser.get(userId) ?? 0) + 1);
}

function decrementSse(userId: number): void {
  const current = sseConnectionsPerUser.get(userId) ?? 0;
  if (current <= 1) sseConnectionsPerUser.delete(userId);
  else sseConnectionsPerUser.set(userId, current - 1);
}

// In-memory location store — persists for server lifetime (no DB required)
const locationStore = new Map<number, Map<string, LocationEntry>>();

function broadcast(store: Map<number, Set<SseClient>>, groupId: number, data: object): void {
  const group = store.get(groupId);
  if (!group || group.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of group) {
    try {
      client.res.write(payload);
    } catch {
      group.delete(client);
    }
  }
}

// ===== Helpers pour unregister propre =====

/** Supprime le client du Set et nettoie l'entrée de la Map si le Set devient vide. */
function removeClient(store: Map<number, Set<SseClient>>, groupId: number, client: SseClient): void {
  const set = store.get(groupId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) store.delete(groupId);
}

export function registerChatClient(groupId: number, userId: number, res: Response): () => void {
  if (!chatClients.has(groupId)) chatClients.set(groupId, new Set());
  const client: SseClient = { userId, res };
  chatClients.get(groupId)!.add(client);
  incrementSse(userId);
  return () => { removeClient(chatClients, groupId, client); decrementSse(userId); };
}

export function broadcastChatMessage(groupId: number, message: object): void {
  broadcast(chatClients, groupId, { type: "message", payload: message });
}

export function registerLocationClient(groupId: number, userId: number, res: Response): () => void {
  if (!locationClients.has(groupId)) locationClients.set(groupId, new Set());
  const client: SseClient = { userId, res };
  locationClients.get(groupId)!.add(client);
  incrementSse(userId);
  return () => { removeClient(locationClients, groupId, client); decrementSse(userId); };
}

export function broadcastLocationUpdate(groupId: number, data: object): void {
  broadcast(locationClients, groupId, { type: "location", payload: data });
}

// ===== Location store (in-memory, persists across navigations for all connected users) =====

export function storeLocation(groupId: number, entry: LocationEntry): void {
  if (!locationStore.has(groupId)) locationStore.set(groupId, new Map());
  locationStore.get(groupId)!.set(entry.userId, entry);
}

export function getGroupLocations(groupId: number): LocationEntry[] {
  return Array.from(locationStore.get(groupId)?.values() ?? []);
}

// ===== Nettoyage périodique des positions périmées (> 1 heure) =====

const LOCATION_STALE_MS = 60 * 60 * 1000; // 1 heure

function cleanupStaleLocations(): void {
  const cutoff = Date.now() - LOCATION_STALE_MS;
  let removed = 0;

  for (const [groupId, userMap] of locationStore) {
    for (const [userId, entry] of userMap) {
      if (new Date(entry.updatedAt).getTime() < cutoff) {
        userMap.delete(userId);
        removed++;
      }
    }
    if (userMap.size === 0) locationStore.delete(groupId);
  }

  if (removed > 0) {
    console.log(`[SSE] cleanupStaleLocations: ${removed} position(s) périmée(s) supprimée(s)`);
  }
}

setInterval(cleanupStaleLocations, 5 * 60 * 1000);

// ===== Métriques SSE (log toutes les 60 secondes) =====

function logSseMetrics(): void {
  const chatCount = [...chatClients.values()].reduce((s, set) => s + set.size, 0);
  const locationCount = [...locationClients.values()].reduce((s, set) => s + set.size, 0);
  const refreshCount = [...refreshClients.values()].reduce((s, set) => s + set.size, 0);
  const total = chatCount + locationCount + refreshCount;
  const uniqueUsers = sseConnectionsPerUser.size;
  const locationGroups = locationStore.size;
  const locationEntries = [...locationStore.values()].reduce((s, m) => s + m.size, 0);

  console.log(
    `[SSE] clients=${total} (chat=${chatCount} loc=${locationCount} refresh=${refreshCount})` +
    ` users=${uniqueUsers} | locationStore: ${locationEntries} positions dans ${locationGroups} groupe(s)`
  );
}

setInterval(logSseMetrics, 60 * 1000);

// ===== Refresh SSE channel — notifies clients to re-fetch a given module =====

export function registerRefreshClient(groupId: number, userId: number, res: Response): () => void {
  if (!refreshClients.has(groupId)) refreshClients.set(groupId, new Set());
  const client: SseClient = { userId, res };
  refreshClients.get(groupId)!.add(client);
  incrementSse(userId);
  return () => { removeClient(refreshClients, groupId, client); decrementSse(userId); };
}

export function broadcastRefresh(groupId: number, module: string): void {
  broadcast(refreshClients, groupId, { type: "refresh", module });
}

/** Comme broadcastRefresh mais avec des champs supplémentaires (ex. senderName pour SOS). */
export function broadcastRefreshWithPayload(groupId: number, payload: { type: "refresh"; module: string; [key: string]: unknown }): void {
  broadcast(refreshClients, groupId, payload);
}

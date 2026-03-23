import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const QUEUE_KEY = "@ravvy/offline_queue";

export type OfflineActionType =
  | "chat.send"
  | "shopping.add"
  | "tasks.add"
  | "polls.vote";

export type QueuedAction = {
  id: string;
  type: OfflineActionType;
  payload: any;
  timestamp: number;
};

async function load(): Promise<QueuedAction[]> {
  if (Platform.OS === "web") return [];
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

async function save(queue: QueuedAction[]): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function getQueue(): Promise<QueuedAction[]> {
  return load();
}

export async function enqueueOfflineAction(
  type: OfflineActionType,
  payload: any
): Promise<void> {
  const queue = await load();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: Date.now(),
  });
  await save(queue);
}

export async function removeOfflineAction(id: string): Promise<void> {
  const queue = await load();
  await save(queue.filter((a) => a.id !== id));
}

import * as db from "../db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export interface PushOptions {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "high";
}

async function sendBatch(tokens: { token: string }[], opts: PushOptions): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: opts.title,
    body: opts.body,
    data: opts.data ?? {},
    priority: opts.priority ?? "default",
    sound: "default",
  }));

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    let response: Response;

    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
    } catch {
      // Retry once on network error
      try {
        response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(batch),
        });
      } catch (retryErr) {
        console.warn("[Push] Network error after retry:", retryErr);
        continue;
      }
    }

    if (!response.ok) continue;

    // Remove tokens flagged as DeviceNotRegistered
    try {
      const json = await response.json();
      const receipts: Array<{ status: string; details?: { error?: string } }> = json.data ?? [];
      const invalidTokenIndices = receipts.reduce<number[]>((acc, r, idx) => {
        if (r.status === "error" && r.details?.error === "DeviceNotRegistered") acc.push(idx);
        return acc;
      }, []);
      for (const idx of invalidTokenIndices) {
        await db.deletePushTokenByToken(batch[idx].to).catch(() => {});
      }
    } catch {}
  }
}

/**
 * Sends a push notification to all members of a group.
 * Optionally excludes one user (e.g. the sender).
 */
export async function sendToGroup(
  groupId: number,
  opts: PushOptions,
  excludeUserId?: number
): Promise<void> {
  const tokens = await db.getPushTokensForGroup(groupId);
  const filtered = excludeUserId ? tokens.filter((t) => t.userId !== excludeUserId) : tokens;
  await sendBatch(filtered, opts);
}

/**
 * Sends a push notification to a single user (all their registered devices).
 */
export async function sendToUser(userId: number, opts: PushOptions): Promise<void> {
  const tokens = await db.getUserPushTokens(userId);
  await sendBatch(tokens, opts);
}

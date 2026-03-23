import { z } from "zod";

// ============================================================
// Domain schemas — source of truth for JSON column structures
// ============================================================

export const pollOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
  votes: z.array(z.string()),
});
export type PollOption = z.infer<typeof pollOptionSchema>;
export const pollOptionsSchema = z.array(pollOptionSchema);

export const passengerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
});
export type Passenger = z.infer<typeof passengerSchema>;
export const passengersSchema = z.array(passengerSchema);

export const reactionSchema = z.object({
  emoji: z.string(),
  userId: z.string(),
});
export type Reaction = z.infer<typeof reactionSchema>;
export const reactionsSchema = z.array(reactionSchema);

// ============================================================
// Zod refinements for tRPC input — validate stringified JSON
// ============================================================

/**
 * Wraps a Zod schema so it can validate a JSON *string* at the tRPC boundary.
 * Usage: z.string().superRefine(validateJsonString(pollOptionsSchema, "options"))
 */
export function validateJsonString<T>(schema: z.ZodType<T>, fieldName = "field") {
  return (val: string, ctx: z.RefinementCtx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(val);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName}: JSON invalide` });
      return;
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName}: ${issue.message}` })
      );
    }
  };
}

// ============================================================
// Runtime helpers
// ============================================================

/**
 * Safe JSON parse with optional Zod validation.
 * Returns `fallback` on parse error or schema mismatch.
 */
export function parseJsonColumn<T>(
  raw: string | null | undefined,
  fallback: T,
  schema?: z.ZodType<T>
): T {
  if (raw == null || raw === "") return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (schema) {
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  }
  return parsed as T;
}

/**
 * Serialize a value to a JSON string for storage in a text/json column.
 */
export function serializeJsonColumn<T>(data: T): string {
  return JSON.stringify(data);
}

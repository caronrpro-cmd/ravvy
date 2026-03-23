import type { Express, Request, Response } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const scryptAsync = promisify(scrypt);

// ─── Password hashing (Node crypto, no extra package) ────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  try {
    return timingSafeEqual(Buffer.from(key, "hex"), derived);
  } catch {
    return false;
  }
}

// ─── JWT signing (same format as sdk.signSession) ────────────────────────────

const JWT_SECRET_FALLBACK = "local-dev-secret-please-set-JWT_SECRET-in-env";

async function signToken(openId: string, name: string): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret || JWT_SECRET_FALLBACK);
  if (!ENV.cookieSecret) {
    console.warn("[LocalAuth] JWT_SECRET not set — using insecure fallback. Set JWT_SECRET in .env");
  }
  const appId = ENV.appId || "local";
  return new SignJWT({ openId, appId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secret);
}

// ─── Shared response builder ──────────────────────────────────────────────────

function userResponse(user: Awaited<ReturnType<typeof db.getUserById>>) {
  return {
    id: user!.id,
    openId: user!.openId,
    name: user!.name,
    email: user!.email,
    loginMethod: user!.loginMethod,
    lastSignedIn: user!.lastSignedIn.toISOString(),
  };
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(body: unknown): { name: string; email: string; password: string } | string {
  if (!body || typeof body !== "object") return "Corps de requête invalide";
  const { name, email, password } = body as Record<string, unknown>;
  if (typeof name !== "string" || name.trim().length < 1) return "Le nom est requis";
  if (name.trim().length > 100) return "Le nom ne peut pas dépasser 100 caractères";
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return "Email invalide";
  if (typeof password !== "string" || password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères";
  if (password.length > 128) return "Mot de passe trop long";
  return { name: name.trim(), email: email.toLowerCase(), password };
}

function validateLogin(body: unknown): { email: string; password: string } | string {
  if (!body || typeof body !== "object") return "Corps de requête invalide";
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return "Email invalide";
  if (typeof password !== "string" || !password) return "Mot de passe requis";
  return { email: email.toLowerCase(), password };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerLocalAuthRoutes(app: Express) {
  /**
   * POST /api/auth/local/register
   * Body: { name, email, password }
   * Returns: { token, user }
   */
  app.post("/api/auth/local/register", async (req: Request, res: Response) => {
    const validated = validateRegister(req.body);
    if (typeof validated === "string") {
      res.status(400).json({ error: validated });
      return;
    }
    const { name, email, password } = validated;

    // Check email not already taken
    const existing = await db.getCredentialsByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Un compte existe déjà avec cet email" });
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await db.createLocalUser({ name, email, passwordHash });
      const token = await signToken(user.openId, user.name ?? name);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.status(201).json({ token, user: userResponse(user) });
    } catch (err) {
      console.error("[LocalAuth] Register error:", err);
      res.status(500).json({ error: "Erreur lors de la création du compte" });
    }
  });

  /**
   * POST /api/auth/local/login
   * Body: { email, password }
   * Returns: { token, user }
   */
  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    const validated = validateLogin(req.body);
    if (typeof validated === "string") {
      res.status(400).json({ error: validated });
      return;
    }
    const { email, password } = validated;

    const cred = await db.getCredentialsByEmail(email);
    if (!cred) {
      // Same message for unknown email and wrong password (timing-safe UX)
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    const valid = await verifyPassword(password, cred.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    try {
      const user = await db.getUserById(cred.userId);
      if (!user) {
        res.status(500).json({ error: "Compte introuvable" });
        return;
      }

      // Update lastSignedIn
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const token = await signToken(user.openId, user.name ?? email);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ token, user: userResponse(user) });
    } catch (err) {
      console.error("[LocalAuth] Login error:", err);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  });
}

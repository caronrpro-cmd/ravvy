import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const JWT_SECRET_FALLBACK = "local-dev-secret-please-set-JWT_SECRET-in-env";

async function signToken(openId: string, name: string): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret || JWT_SECRET_FALLBACK);
  const appId = ENV.appId || "local";
  return new SignJWT({ openId, appId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secret);
}

function buildUserResponse(user: any) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerGoogleAuthRoutes(app: Express) {
  /**
   * POST /api/auth/google
   * Body: { accessToken }
   * Returns: { token, user }
   */
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== "string") {
      res.status(400).json({ error: "accessToken requis" });
      return;
    }

    try {
      // Fetch user profile from Google using the access token
      const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!googleRes.ok) {
        res.status(401).json({ error: "Token Google invalide" });
        return;
      }

      const profile = await googleRes.json() as {
        sub: string;
        email?: string;
        name?: string;
        given_name?: string;
      };

      const openId = `google:${profile.sub}`;
      const name =
        profile.name ||
        profile.given_name ||
        profile.email?.split("@")[0] ||
        "Utilisateur Google";

      await db.upsertUser({
        openId,
        name,
        email: profile.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      const token = await signToken(openId, name);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ token, user: buildUserResponse(user) });
    } catch (err) {
      console.error("[GoogleAuth] Authentication failed:", err);
      res.status(500).json({ error: "Erreur lors de la connexion Google" });
    }
  });
}

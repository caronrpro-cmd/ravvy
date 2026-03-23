import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
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

export function registerAppleAuthRoutes(app: Express) {
  /**
   * POST /api/auth/apple
   * Body: { identityToken, fullName?: { givenName, familyName } }
   * Returns: { token, user }
   */
  app.post("/api/auth/apple", async (req: Request, res: Response) => {
    const { identityToken, fullName } = req.body;
    if (!identityToken || typeof identityToken !== "string") {
      res.status(400).json({ error: "identityToken requis" });
      return;
    }

    try {
      // Verify Apple identity token using Apple's public JWKS
      const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer: "https://appleid.apple.com",
        // audience matches your app's bundle ID
        audience: process.env.APPLE_CLIENT_ID || "com.ravvy.app",
      });

      const sub = payload.sub as string;
      const email = (payload.email ?? "") as string;
      const openId = `apple:${sub}`;

      // Apple only sends fullName on first sign-in
      const givenName = fullName?.givenName ?? "";
      const familyName = fullName?.familyName ?? "";
      const derivedName =
        givenName || familyName
          ? `${givenName} ${familyName}`.trim()
          : email.split("@")[0] || "Utilisateur Apple";

      await db.upsertUser({
        openId,
        name: derivedName,
        email: email || null,
        loginMethod: "apple",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      const token = await signToken(openId, derivedName);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ token, user: buildUserResponse(user) });
    } catch (err) {
      console.error("[AppleAuth] Token verification failed:", err);
      res.status(401).json({ error: "Token Apple invalide" });
    }
  });
}

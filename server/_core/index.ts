import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import multer from "multer";
import { rateLimit, type Options as RateLimitOptions } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerAppleAuthRoutes } from "./appleAuth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import * as db from "../db";
import { registerChatClient, registerLocationClient, registerRefreshClient, getUserSseCount } from "./sse";

// ============================================================
// Rate limiter factory
// ============================================================

/** Extrait un identifiant utilisateur depuis le header Authorization (token Bearer).
 *  Fallback sur l'IP si absent — garantit une clé stable par session authentifiée. */
function userKey(req: express.Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return `u:${auth.slice(7, 55)}`; // 48 chars du token
  return `ip:${req.ip ?? "unknown"}`;
}

/** Crée un rate limiter avec message d'erreur en français. */
function makeRateLimit(opts: Partial<RateLimitOptions> & { windowMs: number; limit: number }) {
  const retrySeconds = Math.ceil(opts.windowMs / 1000);
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    validate: false, // désactive la validation IPv6 (ERR_ERL_KEY_GEN_IPV6)
    keyGenerator: userKey,
    handler: (_req, res) => {
      res.status(429).json({
        error: `Trop de requêtes, veuillez réessayer dans ${retrySeconds} secondes`,
      });
    },
    ...opts,
  });
}

// 100 req / min par IP — routes API générales
const globalApiLimiter = makeRateLimit({ windowMs: 60_000, limit: 100, keyGenerator: (req) => `ip:${req.ip ?? "unknown"}` });

// 5 req / min par utilisateur — SOS uniquement
const sosLimiter = makeRateLimit({ windowMs: 60_000, limit: 5 });

// 30 req / min par utilisateur — chat.send uniquement
const chatSendLimiter = makeRateLimit({ windowMs: 60_000, limit: 30 });

/** Middleware tRPC : applique un limiter spécifique selon la procédure appelée.
 *  Fonctionne pour les appels simples (/api/trpc/proc) et batchés (/api/trpc/p1,p2). */
function trpcProcedureLimiter(
  matchers: Array<{ pattern: string; limiter: express.RequestHandler }>
): express.RequestHandler {
  return (req, res, next) => {
    const url = req.url ?? "";
    for (const { pattern, limiter } of matchers) {
      if (url.includes(pattern)) return limiter(req, res, next);
    }
    return next();
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ===== UPLOADS =====
  // UPLOADS_BASE peut pointer vers un Railway Volume (ex: /app/uploads)
  // pour rendre les photos persistantes entre les redéploiements.
  // Par défaut : process.cwd()/uploads (= /app/uploads sur Railway sans volume).
  const uploadsBase = process.env.UPLOADS_BASE ?? path.join(process.cwd(), "uploads");
  const uploadsDir = path.join(uploadsBase, "photos");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const photoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Seules les images sont acceptées"));
    },
  });

  // Sert les fichiers uploadés en accès public
  app.use("/uploads", express.static(uploadsBase));

  // POST /api/upload/photo — reçoit un fichier multipart et retourne son URL publique
  app.post("/api/upload/photo", uploadPhoto.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier reçu" });
      return;
    }
    const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${apiBase}/uploads/photos/${req.file.filename}`;
    res.json({ url });
  });

  // ===== RATE LIMITING =====
  // Limiteur global sur toutes les routes /api (sauf SSE — connexions longues)
  app.use("/api/trpc", globalApiLimiter);
  app.use("/api/trpc", trpcProcedureLimiter([
    { pattern: "notifications.sos", limiter: sosLimiter },
    { pattern: "chat.send",         limiter: chatSendLimiter },
  ]));

  registerOAuthRoutes(app);
  registerLocalAuthRoutes(app);
  registerAppleAuthRoutes(app);
  registerGoogleAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // DEBUG TEMPORAIRE — lister le contenu du dossier uploads
  app.get("/api/debug/uploads", (_req, res) => {
    try {
      const listDir = (dir: string): Record<string, any> => {
        if (!fs.existsSync(dir)) return { exists: false };
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        const dirs: Record<string, any> = {};
        for (const e of entries) {
          if (e.isDirectory()) dirs[e.name] = listDir(path.join(dir, e.name));
          else files.push(e.name);
        }
        return { exists: true, files, dirs };
      };
      res.json({
        uploadsBase,
        uploadsDir,
        cwd: process.cwd(),
        tree: listDir(uploadsBase),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===== SERVER-SENT EVENTS =====

  async function sseRoute(
    req: express.Request,
    res: express.Response,
    register: (groupId: number, userId: number, res: express.Response) => () => void
  ) {
    const groupId = parseInt(req.params.groupId, 10);
    if (isNaN(groupId)) { res.status(400).end(); return; }

    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const member = await db.getGroupMember(groupId, user.id);
    if (!member) { res.status(403).json({ error: "Not a group member" }); return; }

    // Limite à 5 connexions SSE simultanées par utilisateur (toutes channels)
    const MAX_SSE_PER_USER = 5;
    if (getUserSseCount(user.id) >= MAX_SSE_PER_USER) {
      res.status(429).json({ error: "Trop de connexions SSE simultanées (max 5 par utilisateur)" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write(": connected\n\n");

    const unregister = register(groupId, user.id, res);

    const keepalive = setInterval(() => {
      try { res.write(": ping\n\n"); }
      catch { clearInterval(keepalive); unregister(); }
    }, 25_000);

    req.on("close", () => { clearInterval(keepalive); unregister(); });
  }

  app.get("/api/events/chat/:groupId", (req, res) => sseRoute(req, res, registerChatClient));
  app.get("/api/events/location/:groupId", (req, res) => sseRoute(req, res, registerLocationClient));
  app.get("/api/events/refresh/:groupId", (req, res) => sseRoute(req, res, registerRefreshClient));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const http = require("http");

const config = getDefaultConfig(__dirname);

const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});

// Proxy /api/* to the Express backend on port 3000.
// This makes the browser see all traffic as same-origin (localhost:8081),
// which fixes Safari's cross-origin cookie restrictions without needing SameSite=None.
const existingEnhance = nativeWindConfig.server?.enhanceMiddleware;

nativeWindConfig.server = {
  ...nativeWindConfig.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    // Chain with any existing enhanceMiddleware (e.g. from NativeWind).
    // Both arguments must be forwarded — NativeWind calls server.getBundler().
    const inner = existingEnhance ? existingEnhance(metroMiddleware, server) : metroMiddleware;

    return (req, res, next) => {
      if (!req.url.startsWith("/api/")) {
        return inner(req, res, next);
      }

      // Strip hop-by-hop headers: Metro has already decoded chunked encoding
      // on the incoming request, so forwarding 'transfer-encoding: chunked'
      // would corrupt the body when Express tries to re-decode it.
      const HOP_BY_HOP = new Set([
        "connection", "keep-alive", "transfer-encoding", "te",
        "trailers", "upgrade", "proxy-authorization", "proxy-authenticate",
      ]);
      const forwardedHeaders = Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => !HOP_BY_HOP.has(k.toLowerCase()))
      );

      const options = {
        hostname: "localhost",
        port: 3000,
        path: req.url,
        method: req.method,
        headers: {
          ...forwardedHeaders,
          host: "localhost:3000",
        },
      };

      console.log(`[Metro proxy] ${req.method} ${req.url} → http://localhost:3000${req.url}`);

      const proxyReq = http.request(options, (proxyRes) => {
        console.log(`[Metro proxy] ← ${proxyRes.statusCode} ${req.method} ${req.url}`);
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on("error", (err) => {
        console.error(`[Metro proxy] /api/* → :3000 failed: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502);
        }
        res.end("Bad Gateway");
      });

      req.pipe(proxyReq, { end: true });
    };
  },
};

module.exports = nativeWindConfig;

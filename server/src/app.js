import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import { requestLogger } from "./middleware/requestLogger.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  // Security headers. API serves JSON only — CSP is permissive but headers
  // like HSTS, nosniff, frameguard, referrer-policy are all active.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser requests (no Origin header) and the configured origin only.
        if (!origin || origin === env.CORS_ORIGIN) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Global rate limit (auth endpoints have a stricter per-route limiter).
  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
  app.use("/api", (req, res, next) => {
    if (req.path === "/health") return next();
    globalLimiter(req, res, next);
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(sanitizeInput());
  app.use(requestLogger());

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

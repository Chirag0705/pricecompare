import { logger } from "../utils/logger.js";

/**
 * Lightweight request logging: method, path, status, duration.
 * Never logs request bodies, query values, cookies, or auth headers.
 */
export function requestLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
      // Skip noisy health checks and cache hits to keep signal high.
      if (req.originalUrl.startsWith("/api/health") || res.getHeader("X-Cache") === "HIT") {
        logger.debug(line);
      } else if (res.statusCode >= 500) {
        logger.error(line);
      } else if (res.statusCode >= 400) {
        logger.warn(line);
      } else {
        logger.info(line);
      }
    });
    next();
  };
}

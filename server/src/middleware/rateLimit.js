import { ApiError } from "../utils/ApiError.js";

/**
 * Fixed-window in-memory rate limiter for auth endpoints (brute-force protection).
 * Suitable for a single-instance deployment; promote to Redis-backed store when
 * scaling horizontally (see phase.md Phase 7).
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.windowStart >= windowMs) hits.delete(key);
    }
  }, windowMs).unref();

  return (req, _res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil(
        (entry.windowStart + windowMs - now) / 1000
      );
      return next(
        new ApiError(
          429,
          "Too many attempts. Please try again later.",
          "TOO_MANY_REQUESTS",
          [{ field: "retryAfter", message: `${retryAfterSec} seconds` }]
        )
      );
    }
    next();
  };
}

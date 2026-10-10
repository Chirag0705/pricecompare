import { cache } from "../services/cache.js";

/**
 * GET-response cache middleware keyed by catalog version + request URL.
 * On a miss, captures the JSON body and stores it for ttlMs.
 * Honors authenticated requests: never caches responses when an Authorization
 * header is present (wishlisted flags etc. are per-user).
 */
export function apiCache(ttlMs, keyPrefix) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.headers.authorization) return next();

    try {
      const version = await cache.getVersion();
      const key = `v${version}:${keyPrefix}:${req.originalUrl}`;
      const hit = await cache.get(key);
      if (hit) {
        res.setHeader("X-Cache", "HIT");
        return res.json(hit);
      }

      res.setHeader("X-Cache", "MISS");
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode === 200) {
          cache.set(key, body, ttlMs).catch(() => {});
        }
        return originalJson(body);
      };
      next();
    } catch {
      next();
    }
  };
}

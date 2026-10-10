import { env } from "../config/env.js";
import { cache } from "./cache.js";
import { logger } from "../utils/logger.js";

/**
 * Per-store sync lock — formalized job-queue mutual exclusion.
 *
 * Uses Redis SET NX EX when Redis is the active cache backend (multi-instance
 * safe); otherwise falls back to the in-process Set used since Phase 3
 * (single-instance). Both paths degrade gracefully — the DB-backed scheduler
 * from Phase 3 remains the queue of record either way.
 */

const LOCK_TTL_MS = 30 * 60 * 1000; // hard cap on one sync run
const localLocks = new Set();

export async function acquireStoreLock(slug) {
  if (cache.backendName === "redis") {
    try {
      // Reuse cache backend's Redis via a dedicated key in the same namespace.
      const key = `lock:sync:${slug}`;
      const existing = await cache.get(key);
      if (existing) return false;
      await cache.set(key, { pid: process.pid, at: new Date().toISOString() }, LOCK_TTL_MS);
      return true;
    } catch (err) {
      logger.warn(`Distributed lock unavailable (${err.message}); using local lock`);
    }
  }
  if (localLocks.has(slug)) return false;
  localLocks.add(slug);
  return true;
}

export async function releaseStoreLock(slug) {
  if (cache.backendName === "redis") {
    try {
      await cache.del(`lock:sync:${slug}`);
      return;
    } catch {
      /* fall through to local */
    }
  }
  localLocks.delete(slug);
}

export function isStoreLocked(slug) {
  return localLocks.has(slug);
}

export function queueInfo() {
  return {
    backend: cache.backendName === "redis" ? "redis-lock + db-scheduler" : "db-scheduler",
    redisConfigured: Boolean(env.REDIS_URL),
  };
}

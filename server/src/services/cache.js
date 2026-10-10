import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Versioned TTL cache with pluggable backends.
 *
 * Keys are namespaced as `v{version}:{key}`. Invalidating bumps the version
 * (O(1)), instantly hiding every entry from the previous version; stale entries
 * expire naturally via TTL and require no scan/delete pass. Works identically
 * on the in-memory Map (single instance) and Redis (multi-instance).
 *
 * Backend selection: Redis when REDIS_URL is set and the connection succeeds;
 * otherwise an in-memory Map. Any Redis error after init (e.g. it goes down)
 * degrades per-call to the in-memory backend so the app keeps working.
 */

const MAX_MEMORY_ENTRIES = 2000;

let redis = null;
let memoryBackend = createMemoryBackend();
let currentBackend = memoryBackend;
let initialized = false;

function createMemoryBackend() {
  const store = new Map();
  return {
    name: "memory",
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlMs) {
      if (store.size >= MAX_MEMORY_ENTRIES) {
        // Drop the oldest quarter (insertion-ordered Map).
        const toDrop = Math.ceil(MAX_MEMORY_ENTRIES / 4);
        let dropped = 0;
        for (const k of store.keys()) {
          store.delete(k);
          dropped += 1;
          if (dropped >= toDrop) break;
        }
      }
      store.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : 0 });
    },
    async del(key) {
      store.delete(key);
    },
    async incr(key) {
      const entry = store.get(key);
      const next = (Number(entry?.value) || 0) + 1;
      store.set(key, { value: next, expiresAt: 0 });
      return next;
    },
    async getNumber(key) {
      const entry = store.get(key);
      if (!entry) return 0;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return 0;
      }
      return Number(entry.value) || 0;
    },
  };
}

/** Idempotent; called at startup. Safe to call again (no-op after first success). */
export async function initCache() {
  if (initialized) return;
  initialized = true;

  if (!env.REDIS_URL) {
    logger.info("Cache: using in-memory backend (REDIS_URL not set)");
    return;
  }

  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    client.on("error", (err) => {
      logger.warn(`Cache: Redis error (${err.message}); falling back to memory`);
      currentBackend = memoryBackend;
    });
    client.on("ready", () => {
      logger.info("Cache: connected to Redis");
      currentBackend = redis ?? createRedisBackend(client);
      redis = client;
    });
    await client.connect();
    redis = client;
    currentBackend = createRedisBackend(client);
    logger.info("Cache: connected to Redis");
  } catch (err) {
    logger.warn(`Cache: Redis unavailable (${err.message}); using in-memory backend`);
    currentBackend = memoryBackend;
  }
}

function createRedisBackend(client) {
  return {
    name: "redis",
    async get(key) {
      const raw = await client.get(key);
      return raw === null ? null : JSON.parse(raw);
    },
    async set(key, value, ttlMs) {
      const payload = JSON.stringify(value);
      if (ttlMs) await client.set(key, payload, "PX", ttlMs);
      else await client.set(key, payload);
    },
    async del(key) {
      await client.del(key);
    },
    async incr(key) {
      return client.incr(key);
    },
    async getNumber(key) {
      const v = await client.get(key);
      return Number(v) || 0;
    },
  };
}

export const cache = {
  get backendName() {
    return currentBackend.name;
  },

  async get(key) {
    try {
      return await currentBackend.get(key);
    } catch (err) {
      logger.debug(`Cache get failed (${key}): ${err.message}`);
      return null;
    }
  },

  async set(key, value, ttlMs) {
    try {
      await currentBackend.set(key, value, ttlMs);
    } catch (err) {
      logger.debug(`Cache set failed (${key}): ${err.message}`);
    }
  },

  async del(key) {
    try {
      await currentBackend.del(key);
    } catch (err) {
      logger.debug(`Cache del failed (${key}): ${err.message}`);
    }
  },

  /** Current catalog version (included in every key prefix). */
  async getVersion() {
    try {
      const v = await currentBackend.getNumber("catalog:version");
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  },

  /** Bump catalog version — invalidates every catalog-scoped entry at once. */
  async invalidateCatalog() {
    try {
      const v = await currentBackend.incr("catalog:version");
      logger.debug(`Cache: catalog invalidated (v${v})`);
    } catch (err) {
      logger.debug(`Cache invalidate failed: ${err.message}`);
    }
  },

  async stats() {
    return {
      backend: currentBackend.name,
      version: await this.getVersion(),
    };
  },
};

export async function closeCache() {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      /* ignore */
    }
    redis = null;
  }
  currentBackend = memoryBackend;
}

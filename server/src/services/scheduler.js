import { Store, SyncJob } from "../models/index.js";
import { getAdapter } from "../integrations/registry.js";
import { ingestBatch, logActivity } from "./ingestion.js";
import { acquireStoreLock, releaseStoreLock, isStoreLocked } from "./jobQueue.js";
import { logger } from "../utils/logger.js";

const RETRY_ATTEMPTS = 2;
const RETRY_BASE_MS = 5000;

let schedulerTimer = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Execute one sync job for a store with fetch retries + backoff.
 * Job lifecycle: pending → running → success | failed.
 */
export async function runSyncJob(job, store, { searchTerms } = {}) {
  const adapter = getAdapter(store.slug);
  job.status = "running";
  job.startedAt = new Date();
  await job.save();

  if (!adapter) {
    job.status = "failed";
    job.error = `No adapter registered for store "${store.slug}"`;
    job.finishedAt = new Date();
    await job.save();
    return job;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const { listings, nextCursor } = await adapter.fetchListings({ searchTerms });
      const stats = await ingestBatch(store, listings);
      job.stats = stats;
      job.cursor = nextCursor;
      job.status = "success";
      job.error = undefined;
      job.finishedAt = new Date();
      await job.save();
      await logActivity("sync.success", "SyncJob", job._id, {
        store: store.slug,
        stats,
      });
      logger.info(
        `Sync success (${store.slug}): ${stats.created} created, ${stats.updated} updated, ${stats.unmatched} unmatched, ${stats.errors} errors`
      );
      return job;
    } catch (err) {
      lastError = err;
      // Config errors will not fix themselves — fail fast without backoff.
      if (err.kind === "config") break;
      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        logger.warn(
          `Sync attempt ${attempt + 1} failed for ${store.slug}: ${err.message}. Retrying in ${delay}ms`
        );
        await sleep(delay);
      }
    }
  }

  job.status = "failed";
  job.error = lastError?.message || "Unknown sync failure";
  job.stats.errors = (job.stats?.errors || 0) + 1;
  job.finishedAt = new Date();
  await job.save();
  await logActivity("sync.failed", "SyncJob", job._id, {
    store: store.slug,
    error: job.error,
  });
  logger.error(`Sync failed (${store.slug}): ${job.error}`);
  return job;
}

/** Create a job (scheduled|manual) and run it, respecting one-run-per-store. */
export async function triggerSync(storeSlug, { type = "manual", searchTerms } = {}) {
  const store = await Store.findOne({ slug: storeSlug, active: true });
  if (!store) {
    const err = new Error(`Active store not found: ${storeSlug}`);
    err.statusCode = 404;
    throw err;
  }
  const locked = await acquireStoreLock(store.slug);
  if (!locked) {
    const err = new Error(`A sync is already running for ${store.slug}`);
    err.statusCode = 409;
    throw err;
  }

  const job = await SyncJob.create({ type, store: store._id, status: "pending" });
  try {
    return await runSyncJob(job, store, { searchTerms });
  } finally {
    await releaseStoreLock(store.slug);
  }
}

/** Trigger without awaiting completion (for scheduler + fire-and-forget admin trigger). */
export function triggerSyncAsync(storeSlug, opts = {}) {
  return triggerSync(storeSlug, opts).catch((err) =>
    logger.error(`Async sync failed (${storeSlug})`, err.message)
  );
}

async function tick() {
  const stores = await Store.find({ active: true });
  for (const store of stores) {
    if (isStoreLocked(store.slug)) continue;
    triggerSyncAsync(store.slug, { type: "scheduled" });
  }
}

export function startScheduler(intervalMs) {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(tick, intervalMs);
  schedulerTimer.unref();
  logger.info(`Sync scheduler started (every ${Math.round(intervalMs / 60000)}m)`);
  // Initial run shortly after boot
  setTimeout(tick, 10000).unref();
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Sync scheduler stopped");
  }
}

export function isStoreRunning(slug) {
  return isStoreLocked(slug);
}

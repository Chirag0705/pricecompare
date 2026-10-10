import {
  Product,
  StoreListing,
  PriceHistory,
  DataQualityIssue,
  Store,
  ActivityLog,
} from "../models/index.js";
import { canonicalListingSchema } from "../integrations/contract.js";
import { findBestMatch, normalizeTitle } from "./matching.js";
import { emitPriceChanged } from "./priceEvents.js";
import { cache } from "./cache.js";
import { logger } from "../utils/logger.js";

function computeDiscount(mrp, price) {
  if (mrp && mrp > price && mrp > 0) {
    return Math.round(((mrp - price) / mrp) * 100);
  }
  return undefined;
}

async function openIssue(type, description, refs = {}) {
  await DataQualityIssue.create({
    type,
    description,
    status: "open",
    ...refs,
  });
}

async function recordPrice(listing, product, price, mrp) {
  const last = await PriceHistory.findOne({ listing: listing._id })
    .sort({ capturedAt: -1 })
    .lean();
  if (last && last.price === price) return false;
  await PriceHistory.create({
    listing: listing._id,
    product: product._id,
    price,
    mrp,
    capturedAt: new Date(),
  });
  return true;
}

/**
 * Ingest one canonical listing (already normalized by an adapter).
 * Returns: { outcome: "created"|"updated"|"unmatched"|"invalid", productId? }
 *  - created: new Product + StoreListing
 *  - updated: listing attached/updated on existing Product
 *  - unmatched: new Product created + DataQualityIssue(ambiguous_match) open
 *  - invalid: not persisted; DataQualityIssue(invalid_data) open
 */
export async function ingestListing(storeId, rawListing) {
  const parsed = canonicalListingSchema.safeParse(rawListing);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    await openIssue(
      "invalid_data",
      `Rejected malformed listing (${detail}). Raw storeProductId: ${
        rawListing?.storeProductId ?? "unknown"
      }`,
      { store: storeId }
    );
    return { outcome: "invalid" };
  }
  const listing = parsed.data;

  // In-batch + DB existence check (store + storeProductId unique)
  const existingListing = await StoreListing.findOne({
    store: storeId,
    storeProductId: listing.storeProductId,
  });

  const match = await findBestMatch(listing);

  if (match.ambiguous) {
    // Quarantined from auto-merge: create a separate product so the listing
    // is searchable, and flag for admin review with the suggested candidate.
    const product = await createProductFromListing(listing);
    await attachListing(product, storeId, listing);
    await openIssue(
      "ambiguous_match",
      `Listing "${listing.title}" (store product ${listing.storeProductId}) resembles product "${match.suggested?.title ?? "unknown"}" (confidence ${(match.confidence * 100).toFixed(1)}%, method ${match.method}) but was not auto-merged.`,
      {
        product: product._id,
        suggested: match.suggested?._id,
        store: storeId,
      }
    );
    return { outcome: "unmatched", productId: product._id };
  }

  if (match.product) {
    await attachListing(match.product, storeId, listing, existingListing);
    return { outcome: "updated", productId: match.product._id };
  }

  // Clean new product discovery
  const product = await createProductFromListing(listing);
  await attachListing(product, storeId, listing);
  return { outcome: "created", productId: product._id };
}

async function createProductFromListing(listing) {
  return Product.create({
    title: listing.title,
    brand: listing.brand,
    model: listing.model,
    sku: listing.sku,
    identifiers: {
      gtin: listing.gtin,
      ean: listing.ean,
      upc: listing.upc,
    },
    images: listing.images,
    specs: listing.specs,
    variant: {
      color: listing.color,
      size: listing.size,
      name: listing.variantName,
    },
    normalizedTitle: normalizeTitle(listing.title),
  });
}

/**
 * Create or update the StoreListing; append PriceHistory only on price
 * change; emit priceChanged event. Returns true when price changed.
 */
async function attachListing(product, storeId, listing, existing = null) {
  const doc =
    existing ||
    (await StoreListing.findOne({
      store: storeId,
      storeProductId: listing.storeProductId,
    }));

  const priceChanged = !doc || doc.currentPrice !== listing.price;
  const oldPrice = doc ? doc.currentPrice : null;

  const fields = {
    product: product._id,
    store: storeId,
    storeProductId: listing.storeProductId,
    url: listing.url,
    affiliateUrl: listing.affiliateUrl || listing.url,
    currentPrice: listing.price,
    mrp: listing.mrp,
    discountPercent: computeDiscount(listing.mrp, listing.price),
    availability: listing.availability,
    deliveryInfo: listing.deliveryInfo,
    lastSyncedAt: new Date(),
  };

  let saved;
  if (doc) {
    Object.assign(doc, fields);
    saved = await doc.save();
  } else {
    saved = await StoreListing.create(fields);
  }

  if (priceChanged) {
    await recordPrice(saved, product, listing.price, listing.mrp);
    emitPriceChanged({
      productId: product._id,
      listingId: saved._id,
      storeId,
      oldPrice,
      newPrice: listing.price,
      mrp: listing.mrp,
    });
  }

  return priceChanged;
}

/**
 * Ingest a batch for one store within a SyncJob context.
 * Dedupes within the batch by storeProductId (last wins).
 * Returns stats: { fetched, created, updated, unmatched, errors }
 */
export async function ingestBatch(store, listings) {
  const stats = { fetched: listings.length, created: 0, updated: 0, unmatched: 0, errors: 0 };

  const deduped = new Map();
  for (const l of listings) {
    const key = l?.storeProductId ?? `__no_id_${deduped.size}`;
    deduped.set(key, l);
  }

  for (const listing of deduped.values()) {
    try {
      const result = await ingestListing(store._id, listing);
      if (result.outcome === "created") stats.created += 1;
      else if (result.outcome === "updated") stats.updated += 1;
      else if (result.outcome === "unmatched") stats.unmatched += 1;
      else if (result.outcome === "invalid") stats.errors += 1;
    } catch (err) {
      stats.errors += 1;
      logger.error(
        `Ingestion error (store ${store.slug})`,
        err.message
      );
      await openIssue(
        "invalid_data",
        `Unexpected ingestion error for "${listing?.title ?? "unknown"}": ${err.message}`,
        { store: store._id }
      ).catch(() => {});
    }
  }

  // Any catalog change invalidates the hot-query cache.
  if (stats.created > 0 || stats.updated > 0) {
    cache.invalidateCatalog().catch(() => {});
  }

  return stats;
}

export async function logActivity(action, entityType, entityId, metadata, actor) {
  await ActivityLog.create({
    actor: actor?._id,
    action,
    entityType,
    entityId: String(entityId),
    metadata,
  });
}

export { Store };

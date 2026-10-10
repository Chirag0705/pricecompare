import { env } from "../../config/env.js";
import { IntegrationError } from "../contract.js";

const TIMEOUT_MS = 20000;

function mapFeedItem(item) {
  const price = Number(item.price ?? item.salePrice ?? item.currentPrice);
  if (!Number.isFinite(price)) return null;
  const mrp = Number(item.mrp ?? item.listPrice ?? item.originalPrice);
  const id = String(item.id ?? item.productId ?? item.styleId ?? "");
  const url = item.url ?? item.productUrl ?? item.pdpUrl ?? "";
  if (!id || !url) return null;

  return {
    storeProductId: id,
    url,
    affiliateUrl: item.affiliateUrl || url,
    title: item.title ?? item.name ?? "",
    brand: item.brand,
    model: item.model,
    sku: item.sku ?? id,
    gtin: item.gtin ?? item.ean ?? undefined,
    ean: item.ean,
    upc: item.upc,
    images: Array.isArray(item.images) ? item.images.slice(0, 5) : [],
    color: item.color,
    size: item.size,
    variantName: item.variantName,
    specs: typeof item.specs === "object" && item.specs ? item.specs : {},
    price,
    mrp: Number.isFinite(mrp) ? mrp : undefined,
    availability:
      item.availability === "out_of_stock" || item.inStock === false
        ? "out_of_stock"
        : "in_stock",
    capturedAt: new Date(),
  };
}

export const myntraAdapter = {
  slug: "myntra",
  name: "Myntra",

  isConfigured() {
    return Boolean(env.MYNTRA_FEED_URL || env.MYNTRA_API_KEY);
  },

  /**
   * Myntra has no public product API; the permitted integration path is an
   * authorized data feed. Fetches a real JSON feed from MYNTRA_FEED_URL.
   * Expected shape: { "listings": [...] } or a bare array of listing objects.
   */
  async fetchListings({ cursor } = {}) {
    if (!env.MYNTRA_FEED_URL) {
      throw new IntegrationError(
        "Myntra adapter is not configured. Set MYNTRA_FEED_URL (authorized JSON feed URL) in server/.env.",
        "config"
      );
    }

    const url = new URL(env.MYNTRA_FEED_URL);
    if (cursor) url.searchParams.set("cursor", cursor);

    let res;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new IntegrationError(
          `Myntra feed timed out after ${TIMEOUT_MS}ms`,
          "timeout"
        );
      }
      throw new IntegrationError(
        `Myntra feed request failed: ${err.message}`,
        "http"
      );
    }

    if (res.status === 429) {
      throw new IntegrationError("Myntra feed rate limited (429)", "rate_limit");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new IntegrationError(
        `Myntra feed returned ${res.status}: ${text.slice(0, 300)}`,
        "http"
      );
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new IntegrationError("Myntra feed returned malformed JSON", "parse");
    }

    const raw = Array.isArray(data) ? data : data.listings || [];
    const listings = [];
    for (const item of raw) {
      const mapped = mapFeedItem(item);
      if (mapped) listings.push(mapped);
    }

    return { listings, nextCursor: data?.nextCursor };
  },
};

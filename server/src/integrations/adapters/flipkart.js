import { env } from "../../config/env.js";
import { IntegrationError } from "../contract.js";

const BASE = "https://affiliate-api.flipkart.net/affiliate/1.0/search.json";
const TIMEOUT_MS = 20000;

function mapProduct(p) {
  const price = Number(p.productBaseInfoV1?.productDiscountPrice?.amount);
  const mrp = Number(p.productBaseInfoV1?.productPrice?.amount);
  if (!Number.isFinite(price)) return null;

  const base = p.productBaseInfoV1 || {};
  const attrs = base.attributes || {};

  return {
    storeProductId: base.productId,
    url: base.productUrl,
    affiliateUrl: base.productUrl,
    title: base.title || "",
    brand: attrs.brand,
    model: attrs.model || attrs.modelNumber,
    sku: base.productId,
    gtin: base.productBarcode || undefined,
    ean: undefined,
    upc: undefined,
    images: base.imageUrls?.[0] ? base.imageUrls.slice(0, 5) : [],
    color: attrs.color,
    size: attrs.size,
    specs: Object.fromEntries(
      Object.entries(attrs)
        .filter(([, v]) => typeof v === "string")
        .slice(0, 20)
    ),
    price,
    mrp: Number.isFinite(mrp) ? mrp : undefined,
    availability: "in_stock",
    capturedAt: new Date(),
  };
}

export const flipkartAdapter = {
  slug: "flipkart",
  name: "Flipkart",

  isConfigured() {
    return Boolean(env.FLIPKART_CLIENT_ID && env.FLIPKART_CLIENT_SECRET);
  },

  /**
   * Real Flipkart affiliate/partner search API call (header-authenticated).
   */
  async fetchListings({ searchTerms = [] } = {}) {
    if (!this.isConfigured()) {
      throw new IntegrationError(
        "Flipkart adapter is not configured. Set FLIPKART_CLIENT_ID and FLIPKART_CLIENT_SECRET in server/.env.",
        "config"
      );
    }

    const terms = searchTerms.length ? searchTerms : ["laptop", "headphones"];
    const listings = [];

    for (const query of terms) {
      const url = `${BASE}?query=${encodeURIComponent(query)}&resultCount=10`;

      let res;
      try {
        res = await fetch(url, {
          headers: {
            "Fk-Affiliate-Id": env.FLIPKART_CLIENT_ID,
            "Fk-Affiliate-Token": env.FLIPKART_CLIENT_SECRET,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new IntegrationError(
            `Flipkart API timed out after ${TIMEOUT_MS}ms for "${query}"`,
            "timeout"
          );
        }
        throw new IntegrationError(
          `Flipkart API request failed: ${err.message}`,
          "http"
        );
      }

      if (res.status === 429) {
        throw new IntegrationError("Flipkart API rate limit exceeded (429)", "rate_limit");
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new IntegrationError(
          `Flipkart API returned ${res.status}: ${text.slice(0, 300)}`,
          "http"
        );
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new IntegrationError("Flipkart API returned malformed JSON", "parse");
      }

      for (const p of data.productSearches?.[0]?.products || []) {
        const mapped = mapProduct(p);
        if (mapped) listings.push(mapped);
      }
    }

    return { listings, nextCursor: undefined };
  },
};

import { Product } from "../models/index.js";

export function normalizeTitle(title) {
  return String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeToken(value) {
  if (value === undefined || value === null) return "";
  return normalizeTitle(String(value));
}

/** Dice coefficient over character bigrams — similarity between 0 and 1. */
export function titleSimilarity(a, b) {
  const s1 = normalizeTitle(a).replace(/\s/g, "");
  const s2 = normalizeTitle(b).replace(/\s/g, "");
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;

  const bigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };

  const m1 = bigrams(s1);
  const m2 = bigrams(s2);
  let intersections = 0;
  for (const [bg, count] of m1) {
    const other = m2.get(bg);
    if (other) intersections += Math.min(count, other);
  }
  const total1 = s1.length - 1;
  const total2 = s2.length - 1;
  return (2 * intersections) / (total1 + total2);
}

export const AUTO_MATCH_THRESHOLD = 0.92;
export const AMBIGUOUS_THRESHOLD = 0.75;

function identifierCandidates(listing) {
  const ids = [];
  for (const key of ["gtin", "ean", "upc"]) {
    const v = normalizeToken(listing[key]);
    if (v) ids.push({ field: key, value: v });
  }
  const sku = normalizeToken(listing.sku);
  if (sku) ids.push({ field: "sku", value: sku });
  return ids;
}

function variantOf(doc) {
  const v = doc.variant || {};
  return {
    color: normalizeToken(v.color),
    size: normalizeToken(v.size),
    name: normalizeToken(v.name),
  };
}

function variantOfListing(listing) {
  return {
    color: normalizeToken(listing.color),
    size: normalizeToken(listing.size),
    name: normalizeToken(listing.variantName),
  };
}

/**
 * Match order (phase.md):
 *  1. exact GTIN/EAN/UPC  2. SKU  3. brand + model + variant
 *  4. normalized-name similarity with confidence threshold.
 * Title similarity alone never auto-merges below threshold; ambiguous
 * candidates are returned for admin review instead of auto-merge.
 */
export async function findBestMatch(listing) {
  // 1. Exact identifiers
  for (const { field, value } of identifierCandidates(listing)) {
    if (["gtin", "ean", "upc"].includes(field)) {
      const hit = await Product.findOne({
        [`identifiers.${field}`]: value,
      }).limit(1);
      if (hit) return { product: hit, method: `identifier:${field}`, confidence: 1 };
    }
  }
  // SKU (query products whose sku equals listing sku)
  const sku = normalizeToken(listing.sku);
  if (sku) {
    const hit = await Product.findOne({ sku: listing.sku }).limit(1);
    if (hit) return { product: hit, method: "sku", confidence: 1 };
  }

  // Narrow candidates by brand + normalized title text for similarity pass
  const brand = normalizeToken(listing.brand);
  const query = brand ? { brand: new RegExp(`^${escapeRegex(listing.brand)}$`, "i") } : {};
  const candidates = await Product.find(query)
    .limit(200)
    .select("title brand model sku identifiers variant normalizedTitle");

  const listingVariant = variantOfListing(listing);
  let best = null;

  for (const cand of candidates) {
    const candVariant = variantOf(cand);

    // 3. brand + model + variant (size/color) exact
    const modelOk =
      normalizeToken(cand.model) && normalizeToken(listing.model)
        ? normalizeToken(cand.model) === normalizeToken(listing.model)
        : false;
    if (brand && modelOk) {
      const colorOk =
        !candVariant.color || !listingVariant.color
          ? true
          : candVariant.color === listingVariant.color;
      const sizeOk =
        !candVariant.size || !listingVariant.size
          ? true
          : candVariant.size === listingVariant.size;
      if (colorOk && sizeOk) {
        return { product: cand, method: "brand_model_variant", confidence: 0.99 };
      }
    }

    // 4. title similarity
    const sim = titleSimilarity(listing.title, cand.title);
    const brandConsistent =
      !brand ||
      !normalizeToken(cand.brand) ||
      brand === normalizeToken(cand.brand);

    if (sim >= AUTO_MATCH_THRESHOLD && brandConsistent) {
      if (!best || sim > best.similarity) {
        best = { product: cand, similarity: sim, brandConsistent, method: "title_similarity" };
      }
    } else if (sim >= AMBIGUOUS_THRESHOLD) {
      if (!best || sim > (best.similarity ?? 0)) {
        best = {
          product: cand,
          similarity: sim,
          brandConsistent,
          ambiguous: true,
          method: "title_similarity_ambiguous",
        };
      }
    }
  }

  if (best && !best.ambiguous && best.similarity >= AUTO_MATCH_THRESHOLD && best.brandConsistent) {
    return { product: best.product, method: best.method, confidence: best.similarity };
  }
  if (best && best.ambiguous) {
    return {
      product: null,
      suggested: best.product,
      method: best.method,
      confidence: best.similarity,
      ambiguous: true,
    };
  }
  // Auto-threshold hit but brand inconsistent → treat as ambiguous, never merge
  if (best && !best.brandConsistent) {
    return {
      product: null,
      suggested: best.product,
      method: "brand_conflict",
      confidence: best.similarity,
      ambiguous: true,
    };
  }
  return { product: null, method: "none", confidence: 0 };
}

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

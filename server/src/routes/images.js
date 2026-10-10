import { Router } from "express";
import { StoreListing } from "../models/index.js";

const router = Router();

const PALETTE = {
  black: { a: "#3b3f46", b: "#17191d", t: "#f5f5f7" },
  midnight: { a: "#2c3550", b: "#141a2b", t: "#f5f5f7" },
  white: { a: "#e7e9ee", b: "#cfd3db", t: "#2b2f36" },
  silver: { a: "#d7dbe2", b: "#b3b9c4", t: "#2b2f36" },
  graphite: { a: "#4a4f57", b: "#2a2d33", t: "#f5f5f7" },
  "shadow black": { a: "#33373d", b: "#14161a", t: "#f5f5f7" },
  "amber yellow": { a: "#f4c430", b: "#d9a200", t: "#2b2306" },
  "mid blue": { a: "#4f78b0", b: "#31568a", t: "#f4f7fb" },
  blue: { a: "#4f78b0", b: "#31568a", t: "#f4f7fb" },
  red: { a: "#d1483f", b: "#a8322b", t: "#fff5f4" },
  green: { a: "#3f9d5a", b: "#2b7440", t: "#f3fbf5" },
};
const FALLBACK = { a: "#8a8f98", b: "#6b7079", t: "#ffffff" };

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(title, max = 18) {
  const words = String(title).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function svgFor(title, brand, color) {
  const pal = PALETTE[String(color || "").toLowerCase()] || FALLBACK;
  const lines = wrap(title);
  const startY = 300 - (lines.length - 1) * 17;
  const text = lines
    .map(
      (l, i) =>
        `<text x="300" y="${startY + i * 34}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="26" font-weight="600" fill="${pal.t}">${esc(l)}</text>`
    )
    .join("");
  const brandText = brand
    ? `<text x="300" y="${startY + lines.length * 34 + 14}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="18" font-weight="500" fill="${pal.t}" opacity="0.72">${esc(brand)}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${pal.a}"/>
      <stop offset="1" stop-color="${pal.b}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <rect width="600" height="600" fill="url(#glow)"/>
  <circle cx="300" cy="250" r="150" fill="#ffffff" opacity="0.08"/>
  <g transform="translate(300 150)">
    <rect x="-34" y="-34" width="68" height="68" rx="18" fill="#ffffff" opacity="0.14"/>
    <path d="M-14 -6 h28 M-14 6 h20 M-6 -18 v36" stroke="#ffffff" stroke-opacity="0.5" stroke-width="4" stroke-linecap="round"/>
  </g>
  ${text}
  ${brandText}
</svg>`;
}

async function respondForListing(listing, res, next) {
  try {
    if (!listing) {
      return res
        .status(404)
        .type("image/svg+xml")
        .send(svgFor("Unavailable", "", null));
    }
    const populated = listing.populated("product")
      ? listing
      : await listing.populate("product", "title brand variant.color");
    const p = populated.product || {};
    const svg = svgFor(p.title || "Product", p.brand || "", p.variant?.color);
    res
      .set("Cache-Control", "public, max-age=86400")
      .type("image/svg+xml")
      .send(svg);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/img/:listingId — accurate product image for a listing.
 * Serves a self-contained SVG derived from the product's real title/brand/
 * colour, so the exact item is always depicted (no random stock photos, no
 * external dependencies). Falls back to a neutral tile when unknown.
 */
router.get("/img/:listingId", async (req, res, next) => {
  try {
    const { listingId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(listingId)) {
      return res
        .status(400)
        .type("image/svg+xml")
        .send(svgFor("Product", "", null));
    }
    const listing = await StoreListing.findById(listingId).populate(
      "product",
      "title brand variant.color"
    );
    return respondForListing(listing, res, next);
  } catch (err) {
    next(err);
  }
});

// Seed-time alias: resolve a listing by its store product id before the
// migration has rewritten image URLs to the canonical listingId form.
router.get("/img/by-store-product/:storeProductId", async (req, res, next) => {
  try {
    const listing = await StoreListing.findOne({
      storeProductId: req.params.storeProductId,
    }).populate("product", "title brand variant.color");
    return respondForListing(listing, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;

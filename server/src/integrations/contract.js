import { z } from "zod";

export class IntegrationError extends Error {
  constructor(message, kind = "http", details = undefined) {
    super(message);
    this.name = "IntegrationError";
    this.kind = kind; // config | timeout | rate_limit | http | parse
    this.details = details;
  }
}

const urlish = z.string().trim().min(1);

/**
 * Canonical listing DTO — every adapter must normalize upstream data into
 * this shape before handing it to the ingestion pipeline.
 */
export const canonicalListingSchema = z.object({
  storeProductId: z.string().trim().min(1, "storeProductId is required"),
  url: urlish.refine((v) => /^https?:\/\//.test(v), "url must be http(s)"),
  affiliateUrl: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\//.test(v), "affiliateUrl must be http(s)")
    .optional(),
  title: z.string().trim().min(1, "title is required").max(500),
  brand: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  sku: z.string().trim().max(200).optional(),
  gtin: z.string().trim().max(32).optional(),
  ean: z.string().trim().max(32).optional(),
  upc: z.string().trim().max(32).optional(),
  images: z.array(urlish).max(10).default([]),
  color: z.string().trim().max(100).optional(),
  size: z.string().trim().max(100).optional(),
  variantName: z.string().trim().max(200).optional(),
  specs: z.record(z.string(), z.string().max(1000)).default({}),
  price: z.number().min(0, "price must be >= 0"),
  mrp: z.number().min(0).optional(),
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]).default("unknown"),
  deliveryInfo: z.record(z.string(), z.unknown()).optional(),
  capturedAt: z.coerce.date().optional(),
});

/**
 * Adapter contract:
 *  - slug: store slug (must match Store.slug)
 *  - isConfigured(): boolean — credentials/endpoint present in env
 *  - fetchListings({ cursor, searchTerms }): Promise<{ listings, nextCursor }>
 *    Performs a REAL upstream request. Throws IntegrationError on failure.
 */
export function assertAdapter(adapter) {
  for (const key of ["slug", "name", "isConfigured", "fetchListings"]) {
    if (!(key in adapter)) {
      throw new Error(`Adapter missing required member: ${key}`);
    }
  }
}

import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200, "Search query is too long (max 200 characters)").optional(),
  category: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  store: z.string().trim().max(120).optional(),
  availability: z.enum(["in_stock", "any"]).optional(),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "discount", "newest"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const priceHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id"),
});

export const listingIdParamSchema = z.object({
  listingId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid listing id"),
});

export const suggestionQuerySchema = z.object({
  q: z.string().trim().min(1).max(200, "Query is too long (max 200 characters)"),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

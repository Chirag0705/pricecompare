import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const price = z.number().min(0).max(100000000);

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const productListQuerySchema = adminListQuerySchema.extend({
  category: objectId.optional(),
  brand: z.string().trim().max(200).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const identifierSchema = z
  .object({
    gtin: z.string().trim().max(60).optional().or(z.literal("")),
    ean: z.string().trim().max(60).optional().or(z.literal("")),
    upc: z.string().trim().max(60).optional().or(z.literal("")),
  })
  .strict()
  .optional();

export const createProductSchema = z.object({
  title: z.string().trim().min(3).max(300),
  brand: z.string().trim().max(200).optional().or(z.literal("")),
  model: z.string().trim().max(200).optional().or(z.literal("")),
  sku: z.string().trim().max(120).optional().or(z.literal("")),
  identifiers: identifierSchema,
  category: objectId.nullish(),
  images: z.array(z.string().trim().url().max(2000)).max(10).optional(),
  specs: z.record(z.string().max(300), z.string().max(1000)).optional(),
  variant: z
    .object({
      color: z.string().trim().max(80).optional().or(z.literal("")),
      size: z.string().trim().max(80).optional().or(z.literal("")),
      name: z.string().trim().max(120).optional().or(z.literal("")),
    })
    .strict()
    .optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const mergeProductsSchema = z.object({
  sourceId: objectId,
  targetId: objectId,
});

export const listingListQuerySchema = adminListQuerySchema.extend({
  store: objectId.optional(),
  product: objectId.optional(),
  availability: z.enum(["in_stock", "out_of_stock", "preorder", "unavailable"]).optional(),
  archived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const updateListingSchema = z
  .object({
    currentPrice: price.optional(),
    mrp: price.optional(),
    availability: z.enum(["in_stock", "out_of_stock", "preorder", "unavailable"]).optional(),
    url: z.string().trim().url().max(2000).optional(),
    affiliateUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
    deliveryInfo: z
      .object({
        etaDays: z.number().int().min(0).max(90).optional(),
        freeShipping: z.boolean().optional(),
        codAvailable: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const attachListingSchema = z.object({
  productId: objectId,
});

export const createStoreSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    domain: z.string().trim().url().max(300),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    affiliateConfig: z
      .object({
        paramStyle: z.enum(["query", "path", "none"]).optional(),
        template: z.string().trim().max(2000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const updateStoreSchema = createStoreSchema.partial();

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    parent: objectId.nullish(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const updateCategorySchema = createCategorySchema.partial();

export const userListQuerySchema = adminListQuerySchema.extend({
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "deactivated", "all"]).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.active !== undefined, {
    message: "Provide role or active",
  });

export const activityQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const pricesQuerySchema = z.object({
  store: objectId.optional(),
  availability: z.enum(["in_stock", "out_of_stock", "preorder", "unavailable"]).optional(),
  sort: z.enum(["price_asc", "price_desc", "discount", "updated"]).default("updated"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const priceUpdatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

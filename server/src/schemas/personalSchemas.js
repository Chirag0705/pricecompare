import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const productIdParamSchema = z.object({
  productId: objectId,
});

export const idParamSchema = z.object({
  id: objectId,
});

export const createAlertSchema = z.object({
  productId: objectId,
  targetPrice: z
    .number({ invalid_type_error: "Target price must be a number" })
    .positive("Target price must be a positive number")
    .max(100000000, "Target price is too large"),
});

export const patchAlertSchema = z
  .object({
    active: z.boolean().optional(),
    targetPrice: z
      .number({ invalid_type_error: "Target price must be a number" })
      .positive("Target price must be a positive number")
      .max(100000000, "Target price is too large")
      .optional(),
  })
  .refine((v) => v.active !== undefined || v.targetPrice !== undefined, {
    message: "Provide at least one field to update (active or targetPrice)",
  });

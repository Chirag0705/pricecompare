import { Router } from "express";
import {
  Product,
  StoreListing,
  Category,
  Wishlist,
  PriceAlert,
  Notification,
  PriceHistory,
} from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logActivity } from "../services/ingestion.js";
import { normalizeTitle } from "../services/matching.js";
import { cache } from "../services/cache.js";
import { validate as validateMW } from "../middleware/validate.js";
import {
  productListQuerySchema,
  createProductSchema,
  updateProductSchema,
  mergeProductsSchema,
  listingListQuerySchema,
  updateListingSchema,
  attachListingSchema,
} from "../schemas/adminSchemas.js";
import { idParamSchema } from "../schemas/catalogSchemas.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

function clean(v) {
  return v === undefined || v === "" ? undefined : v;
}

function productPayload(body, existing) {
  const payload = {};
  if (body.title !== undefined) {
    payload.title = body.title;
    payload.normalizedTitle = normalizeTitle(body.title);
  }
  if (body.brand !== undefined) payload.brand = clean(body.brand);
  if (body.model !== undefined) payload.model = clean(body.model);
  if (body.sku !== undefined) payload.sku = clean(body.sku);
  if (body.identifiers !== undefined) {
    payload.identifiers = {
      gtin: clean(body.identifiers.gtin),
      ean: clean(body.identifiers.ean),
      upc: clean(body.identifiers.upc),
    };
  }
  if (body.category !== undefined) payload.category = body.category || null;
  if (body.images !== undefined) payload.images = body.images;
  if (body.specs !== undefined) payload.specs = body.specs;
  if (body.variant !== undefined) {
    payload.variant = {
      color: clean(body.variant.color),
      size: clean(body.variant.size),
      name: clean(body.variant.name),
    };
  }
  if (body.archived !== undefined) payload.archived = body.archived;
  if (existing && payload.normalizedTitle === undefined && body.title !== undefined) {
    payload.normalizedTitle = normalizeTitle(body.title);
  }
  return payload;
}

/* ---------- GET /api/admin/products ---------- */
router.get(
  "/products",
  validateMW(productListQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { q, page, limit, category, brand, includeArchived } = req.query;
      const filter = {};
      if (!includeArchived) filter.archived = { $ne: true };
      if (category) filter.category = category;
      if (brand) filter.brand = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      if (q) {
        filter.$or = [
          { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          { brand: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        ];
      }

      const [products, total] = await Promise.all([
        Product.find(filter)
          .populate("category", "name slug")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Product.countDocuments(filter),
      ]);

      const ids = products.map((p) => p._id);
      const counts = await StoreListing.aggregate([
        { $match: { product: { $in: ids } } },
        { $group: { _id: "$product", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

      res.json({
        success: true,
        data: {
          products: products.map((p) => ({
            ...p.toObject(),
            listingCount: countMap.get(String(p._id)) ?? 0,
          })),
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- POST /api/admin/products ---------- */
router.post(
  "/products",
  validateMW(createProductSchema),
  async (req, res, next) => {
    try {
      const payload = productPayload(req.body);
      payload.normalizedTitle = normalizeTitle(req.body.title);
      const product = await Product.create(payload);
      await logActivity("product.create", "Product", product._id, {
        title: product.title,
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.status(201).json({ success: true, data: { product } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/admin/products/:id ---------- */
router.get(
  "/products/:id",
  validateMW(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id).populate(
        "category",
        "name slug"
      );
      if (!product) throw ApiError.notFound("Product not found");
      const listings = await StoreListing.find({ product: product._id })
        .populate("store", "name slug active")
        .sort({ currentPrice: 1 })
        .lean();
      res.json({ success: true, data: { product, listings } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- PUT /api/admin/products/:id ---------- */
router.put(
  "/products/:id",
  validateMW(idParamSchema, "params"),
  validateMW(updateProductSchema),
  async (req, res, next) => {
    try {
      const existing = await Product.findById(req.params.id);
      if (!existing) throw ApiError.notFound("Product not found");
      if (req.body.category) {
        const cat = await Category.findById(req.body.category).select("_id");
        if (!cat) throw ApiError.badRequest("Category not found");
      }
      const payload = productPayload(req.body, existing);
      Object.assign(existing, payload);
      await existing.save();
      await logActivity("product.update", "Product", existing._id, {
        fields: Object.keys(payload),
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { product: existing } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- POST /api/admin/products/merge ---------- */
router.post(
  "/products/merge",
  validateMW(mergeProductsSchema),
  async (req, res, next) => {
    try {
      const { sourceId, targetId } = req.body;
      if (sourceId === targetId) {
        throw ApiError.badRequest("Source and target must be different products");
      }
      const [source, target] = await Promise.all([
        Product.findById(sourceId),
        Product.findById(targetId),
      ]);
      if (!source || !target) throw ApiError.notFound("Product not found");
      if (source.archived || target.archived) {
        throw ApiError.badRequest("Cannot merge archived products");
      }

      const fields = ["gtin", "ean", "upc"];
      for (const f of fields) {
        const a = source.identifiers?.[f];
        const b = target.identifiers?.[f];
        if (a && b && a !== b) {
          throw ApiError.conflict(
            `Identifier conflict on ${f}: "${a}" (source) vs "${b}" (target). Resolve manually before merging.`
          );
        }
      }

      const mergedIdentifiers = { ...target.identifiers };
      for (const f of fields) {
        if (!mergedIdentifiers[f] && source.identifiers?.[f]) {
          mergedIdentifiers[f] = source.identifiers[f];
        }
      }
      const mergedImages = [
        ...new Set([...(target.images || []), ...(source.images || [])]),
      ];
      const mergedSpecs = {
        ...(source.specs instanceof Map
          ? Object.fromEntries(source.specs)
          : source.specs || {}),
        ...(target.specs instanceof Map
          ? Object.fromEntries(target.specs)
          : target.specs || {}),
      };

      const [listingRes, wishRes, alertRes, notifRes] = await Promise.all([
        StoreListing.updateMany(
          { product: source._id },
          { $set: { product: target._id } }
        ),
        Wishlist.updateMany(
          { product: source._id },
          { $set: { product: target._id } }
        ),
        PriceAlert.updateMany(
          { product: source._id },
          { $set: { product: target._id } }
        ),
        Notification.updateMany(
          { product: source._id },
          { $set: { product: target._id } }
        ),
      ]);

      target.identifiers = mergedIdentifiers;
      target.images = mergedImages;
      if (Object.keys(mergedSpecs).length) target.specs = mergedSpecs;
      if (!target.brand && source.brand) target.brand = source.brand;
      if (!target.model && source.model) target.model = source.model;
      if (!target.sku && source.sku) target.sku = source.sku;
      if (!target.category && source.category) target.category = source.category;
      await target.save();

      source.archived = true;
      await source.save();

      await logActivity(
        "product.merge",
        "Product",
        target._id,
        {
          sourceId: String(source._id),
          sourceTitle: source.title,
          movedListings: listingRes.modifiedCount,
          movedWishlists: wishRes.modifiedCount,
          movedAlerts: alertRes.modifiedCount,
          movedNotifications: notifRes.modifiedCount,
        },
        req.user
      );

      cache.invalidateCatalog().catch(() => {});

      res.json({
        success: true,
        data: {
          product: target,
          merged: {
            sourceId: source._id,
            movedListings: listingRes.modifiedCount,
            movedWishlists: wishRes.modifiedCount,
            movedAlerts: alertRes.modifiedCount,
            movedNotifications: notifRes.modifiedCount,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/admin/listings ---------- */
router.get(
  "/listings",
  validateMW(listingListQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { q, page, limit, store, product, availability, archived } = req.query;
      const filter = {};
      if (store) filter.store = store;
      if (product) filter.product = product;
      if (availability) filter.availability = availability;
      if (archived !== undefined) filter.archived = archived;
      if (q) {
        filter.url = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      }

      const [listings, total] = await Promise.all([
        StoreListing.find(filter)
          .populate("product", "title brand archived")
          .populate("store", "name slug active")
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        StoreListing.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          listings,
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- PUT /api/admin/listings/:id ---------- */
router.put(
  "/listings/:id",
  validateMW(idParamSchema, "params"),
  validateMW(updateListingSchema),
  async (req, res, next) => {
    try {
      const listing = await StoreListing.findById(req.params.id);
      if (!listing) throw ApiError.notFound("Listing not found");
      const body = { ...req.body };
      if (body.mrp !== undefined && body.currentPrice === undefined) {
        // keep discountPercent consistent when only mrp changes
        body.discountPercent =
          body.mrp > 0
            ? Math.max(
                0,
                Math.round(((body.mrp - listing.currentPrice) / body.mrp) * 10000) / 100
              )
            : null;
      }
      if (body.currentPrice !== undefined) {
        const mrp = body.mrp ?? listing.mrp;
        body.discountPercent =
          mrp && mrp > body.currentPrice
            ? Math.max(
                0,
                Math.round(((mrp - body.currentPrice) / mrp) * 10000) / 100
              )
            : null;
      }
      if (body.affiliateUrl === "") body.affiliateUrl = undefined;
      Object.assign(listing, body);
      listing.lastSyncedAt = new Date();
      await listing.save();
      await logActivity("listing.update", "StoreListing", listing._id, {
        fields: Object.keys(req.body),
        productId: String(listing.product),
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { listing } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- POST /api/admin/listings/:id/attach ---------- */
router.post(
  "/listings/:id/attach",
  validateMW(idParamSchema, "params"),
  validateMW(attachListingSchema),
  async (req, res, next) => {
    try {
      const [listing, product] = await Promise.all([
        StoreListing.findById(req.params.id),
        Product.findById(req.body.productId),
      ]);
      if (!listing) throw ApiError.notFound("Listing not found");
      if (!product || product.archived) {
        throw ApiError.badRequest("Target product not found or archived");
      }
      const from = String(listing.product);
      listing.product = product._id;
      await listing.save();
      await logActivity("listing.attach", "StoreListing", listing._id, {
        fromProductId: from,
        toProductId: String(product._id),
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { listing } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DELETE /api/admin/listings/:id ---------- */
router.delete(
  "/listings/:id",
  validateMW(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const listing = await StoreListing.findById(req.params.id);
      if (!listing) throw ApiError.notFound("Listing not found");

      const historyCount = await PriceHistory.countDocuments({ listing: listing._id });

      let mode;
      if (historyCount > 0) {
        // Price history is audit data — soft-archive instead of hard delete.
        listing.archived = true;
        await listing.save();
        mode = "archived";
      } else {
        await StoreListing.findByIdAndDelete(listing._id);
        mode = "deleted";
      }

      await logActivity("listing.delete", "StoreListing", listing._id, {
        mode,
        productId: String(listing.product),
        storeId: String(listing.store),
        url: listing.url,
      }, req.user);

      cache.invalidateCatalog().catch(() => {});

      res.json({
        success: true,
        data: mode === "archived" ? { archived: true } : { deleted: true },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

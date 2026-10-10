import { Router } from "express";
import { Store, Category, Product, StoreListing } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logActivity } from "../services/ingestion.js";
import { cache } from "../services/cache.js";
import { validate as validateMW } from "../middleware/validate.js";
import {
  createStoreSchema,
  updateStoreSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../schemas/adminSchemas.js";
import { idParamSchema } from "../schemas/catalogSchemas.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

/* ---------- GET /api/admin/stores ---------- */
router.get("/stores", async (_req, res, next) => {
  try {
    const stores = await Store.find({}).sort({ sortOrder: 1, name: 1 });
    const counts = await Product.db
      .collection("storelistings")
      .aggregate([
        { $group: { _id: "$store", count: { $sum: 1 } } },
      ])
      .toArray();
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json({
      success: true,
      data: {
        stores: stores.map((s) => ({
          ...s.toObject(),
          listingCount: countMap.get(String(s._id)) ?? 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- POST /api/admin/stores ---------- */
router.post("/stores", validateMW(createStoreSchema), async (req, res, next) => {
  try {
    const store = await Store.create(req.body);
    await logActivity("store.create", "Store", store._id, {
      name: store.name,
      slug: store.slug,
    }, req.user);
    cache.invalidateCatalog().catch(() => {});
    res.status(201).json({ success: true, data: { store } });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/admin/stores/:id ---------- */
router.get(
  "/stores/:id",
  validateMW(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const store = await Store.findById(req.params.id);
      if (!store) throw ApiError.notFound("Store not found");
      res.json({ success: true, data: { store } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- PUT /api/admin/stores/:id ---------- */
router.put(
  "/stores/:id",
  validateMW(idParamSchema, "params"),
  validateMW(updateStoreSchema),
  async (req, res, next) => {
    try {
      const store = await Store.findById(req.params.id);
      if (!store) throw ApiError.notFound("Store not found");
      Object.assign(store, req.body);
      await store.save();
      await logActivity("store.update", "Store", store._id, {
        fields: Object.keys(req.body),
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { store } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DELETE /api/admin/stores/:id ---------- */
router.delete(
  "/stores/:id",
  validateMW(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const store = await Store.findById(req.params.id);
      if (!store) throw ApiError.notFound("Store not found");
      const listingCount = await StoreListing.countDocuments({ store: store._id });
      if (listingCount > 0) {
        throw ApiError.conflict(
          `Store has ${listingCount} listing(s). Disable it instead of deleting, or remove its listings first.`
        );
      }
      await store.deleteOne();
      await logActivity("store.delete", "Store", store._id, {
        name: store.name,
        slug: store.slug,
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/admin/categories ---------- */
router.get("/categories", async (_req, res, next) => {
  try {
    const cats = await Category.find({})
      .sort({ sortOrder: 1, name: 1 })
      .select("name slug parent active sortOrder");
    const [productCounts, childSets] = await Promise.all([
      Product.aggregate([
        { $match: { archived: { $ne: true } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Category.aggregate([
        { $group: { _id: "$parent", count: { $sum: 1 } } },
      ]),
    ]);
    const productMap = new Map(productCounts.map((c) => [String(c._id), c.count]));
    const childMap = new Map(childSets.map((c) => [String(c._id), c.count]));

    const byId = new Map(
      cats.map((c) => [
        String(c._id),
        {
          ...c.toObject(),
          productCount: productMap.get(String(c._id)) ?? 0,
          childCount: childMap.get(String(c._id)) ?? 0,
          children: [],
        },
      ])
    );
    const roots = [];
    for (const c of byId.values()) {
      if (c.parent && byId.has(String(c.parent))) {
        byId.get(String(c.parent)).children.push(c);
      } else {
        roots.push(c);
      }
    }
    res.json({ success: true, data: { categories: roots, total: cats.length } });
  } catch (err) {
    next(err);
  }
});

/* ---------- POST /api/admin/categories ---------- */
router.post(
  "/categories",
  validateMW(createCategorySchema),
  async (req, res, next) => {
    try {
      if (req.body.parent) {
        const parent = await Category.findById(req.body.parent).select("_id");
        if (!parent) throw ApiError.badRequest("Parent category not found");
      }
      const category = await Category.create(req.body);
      await logActivity("category.create", "Category", category._id, {
        name: category.name,
        slug: category.slug,
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.status(201).json({ success: true, data: { category } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- PUT /api/admin/categories/:id ---------- */
router.put(
  "/categories/:id",
  validateMW(idParamSchema, "params"),
  validateMW(updateCategorySchema),
  async (req, res, next) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) throw ApiError.notFound("Category not found");
      if (req.body.parent) {
        if (String(req.body.parent) === String(category._id)) {
          throw ApiError.badRequest("A category cannot be its own parent");
        }
        const parent = await Category.findById(req.body.parent).select("_id");
        if (!parent) throw ApiError.badRequest("Parent category not found");
      }
      Object.assign(category, req.body);
      await category.save();
      await logActivity("category.update", "Category", category._id, {
        fields: Object.keys(req.body),
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { category } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DELETE /api/admin/categories/:id ---------- */
router.delete(
  "/categories/:id",
  validateMW(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) throw ApiError.notFound("Category not found");
      const [childCount, productCount] = await Promise.all([
        Category.countDocuments({ parent: category._id }),
        Product.countDocuments({ category: category._id }),
      ]);
      if (childCount > 0) {
        throw ApiError.conflict(
          `Category has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Delete or move them first.`
        );
      }
      if (productCount > 0) {
        throw ApiError.conflict(
          `Category has ${productCount} product(s). Reassign them before deleting.`
        );
      }
      await category.deleteOne();
      await logActivity("category.delete", "Category", category._id, {
        name: category.name,
        slug: category.slug,
      }, req.user);
      cache.invalidateCatalog().catch(() => {});
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

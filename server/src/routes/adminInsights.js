import { Router } from "express";
import {
  Product,
  StoreListing,
  Store,
  User,
  DataQualityIssue,
  SyncJob,
  ActivityLog,
  PriceHistory,
} from "../models/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate as validateMW } from "../middleware/validate.js";
import {
  activityQuerySchema,
  pricesQuerySchema,
  priceUpdatesQuerySchema,
} from "../schemas/adminSchemas.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

/* ---------- GET /api/admin/stats ---------- */
router.get("/stats", async (_req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      products,
      archivedProducts,
      listings,
      storesTotal,
      storesActive,
      usersTotal,
      usersActive,
      openIssues,
      failedJobs,
      runningJobs,
      clicks,
      priceUpdates7d,
      recentActivity,
    ] = await Promise.all([
      Product.countDocuments({ archived: { $ne: true } }),
      Product.countDocuments({ archived: true }),
      StoreListing.countDocuments(),
      Store.countDocuments(),
      Store.countDocuments({ active: true }),
      User.countDocuments(),
      User.countDocuments({ active: true }),
      DataQualityIssue.countDocuments({ status: "open" }),
      SyncJob.countDocuments({ status: "failed" }),
      SyncJob.countDocuments({ status: "running" }),
      ActivityLog.countDocuments({ action: "click.buy_now" }),
      PriceHistory.countDocuments({ capturedAt: { $gte: weekAgo } }),
      ActivityLog.find({})
        .populate("actor", "name email")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        products,
        archivedProducts,
        listings,
        storesTotal,
        storesActive,
        usersTotal,
        usersActive,
        openIssues,
        failedJobs,
        runningJobs,
        clicks,
        priceUpdates7d,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/admin/prices ---------- */
router.get(
  "/prices",
  validateMW(pricesQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { store, availability, sort, page, limit } = req.query;
      const filter = {};
      if (store) filter.store = store;
      if (availability) filter.availability = availability;

      const sortStage =
        sort === "price_asc"
          ? { currentPrice: 1 }
          : sort === "price_desc"
            ? { currentPrice: -1 }
            : sort === "discount"
              ? { discountPercent: -1 }
              : { updatedAt: -1 };

      const [listings, total] = await Promise.all([
        StoreListing.find(filter)
          .populate("product", "title brand")
          .populate("store", "name slug active")
          .sort(sortStage)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        StoreListing.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          listings: listings.map((l) => ({
            ...l,
            anomaly: (l.discountPercent ?? 0) >= 50 ? "deep_discount" : null,
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

/* ---------- GET /api/admin/prices/updates ---------- */
router.get(
  "/prices/updates",
  validateMW(priceUpdatesQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;

      // Single aggregation with a setWindowFields stage computes each row's
      // previous price in-database (no per-row N+1 query).
      const skip = (page - 1) * limit;
      const [rows, total] = await Promise.all([
        PriceHistory.aggregate([
          { $sort: { capturedAt: -1 } },
          {
            $setWindowFields: {
              partitionBy: "$listing",
              sortBy: { capturedAt: -1 },
              output: {
                previousPrice: { $shift: { output: "$price", by: 1 } },
              },
            },
          },
          { $sort: { capturedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        PriceHistory.countDocuments(),
      ]);

      // Batch-populate product + listing + store in three queries.
      const productIds = [...new Set(rows.map((r) => String(r.product)))];
      const listingIds = [...new Set(rows.map((r) => String(r.listing)))];
      const [products, listings] = await Promise.all([
        Product.find({ _id: { $in: productIds } })
          .select("title brand")
          .lean(),
        StoreListing.find({ _id: { $in: listingIds } })
          .select("store url")
          .lean(),
      ]);
      const storeIds = [...new Set(listings.map((l) => String(l.store)))];
      const stores = await Store.find({ _id: { $in: storeIds } })
        .select("name slug")
        .lean();

      const productMap = new Map(products.map((p) => [String(p._id), p]));
      const storeMap = new Map(stores.map((s) => [String(s._id), s]));
      const listingMap = new Map(
        listings.map((l) => [
          String(l._id),
          { ...l, store: storeMap.get(String(l.store)) ?? l.store },
        ])
      );

      const updates = rows.map((r) => ({
        ...r,
        product: productMap.get(String(r.product)) ?? r.product,
        listing: listingMap.get(String(r.listing)) ?? r.listing,
        delta: r.previousPrice != null ? r.price - r.previousPrice : null,
      }));

      res.json({
        success: true,
        data: { updates, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/admin/activity ---------- */
router.get(
  "/activity",
  validateMW(activityQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { action, entityType, page, limit } = req.query;
      const filter = {};
      if (action) filter.action = action;
      if (entityType) filter.entityType = entityType;

      const [entries, total] = await Promise.all([
        ActivityLog.find(filter)
          .populate("actor", "name email")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ActivityLog.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          entries,
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

export default router;

import { Router } from "express";
import { Wishlist, Product, StoreListing } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { productIdParamSchema } from "../schemas/personalSchemas.js";

const router = Router();
router.use(requireAuth);

/* ---------- GET /api/wishlist ---------- */
router.get("/", async (req, res, next) => {
  try {
    // Clean up any orphaned rows (product deleted by admin).
    const entries = await Wishlist.find({ user: req.user._id })
      .populate("product", "title brand images")
      .sort({ addedAt: -1 })
      .lean();

    const valid = entries.filter((e) => e.product);
    const orphanIds = entries.filter((e) => !e.product).map((e) => e._id);
    if (orphanIds.length) {
      await Wishlist.deleteMany({ _id: { $in: orphanIds } });
    }

    const productIds = valid.map((e) => e.product._id);
    const priceRows = productIds.length
      ? await StoreListing.aggregate([
          { $match: { product: { $in: productIds }, archived: { $ne: true } } },
          {
            $group: {
              _id: "$product",
              inStockMin: {
                $min: {
                  $cond: [
                    { $eq: ["$availability", "in_stock"] },
                    "$currentPrice",
                    null,
                  ],
                },
              },
              anyMin: { $min: "$currentPrice" },
              listingCount: { $sum: 1 },
            },
          },
        ])
      : [];
    const priceById = new Map(
      priceRows.map((r) => [
        String(r._id),
        {
          bestPrice: r.inStockMin ?? r.anyMin ?? null,
          listingCount: r.listingCount,
        },
      ])
    );

    res.json({
      success: true,
      data: {
        items: valid.map((e) => ({
          id: e._id,
          addedAt: e.addedAt,
          product: {
            id: e.product._id,
            title: e.product.title,
            brand: e.product.brand,
            image: e.product.images?.[0] || null,
          },
          bestPrice: priceById.get(String(e.product._id))?.bestPrice ?? null,
          listingCount: priceById.get(String(e.product._id))?.listingCount ?? 0,
        })),
        total: valid.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- POST /api/wishlist/:productId (idempotent add) ---------- */
router.post(
  "/:productId",
  validate(productIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.productId).select("_id");
      if (!product) throw ApiError.notFound("Product not found");

      const existing = await Wishlist.findOne({
        user: req.user._id,
        product: product._id,
      });
      let created = false;
      if (!existing) {
        try {
          await Wishlist.create({ user: req.user._id, product: product._id });
          created = true;
        } catch (err) {
          // Unique index race — treat as already saved.
          if (err.code !== 11000) throw err;
        }
      }

      res.status(created ? 201 : 200).json({
        success: true,
        data: { wished: true, alreadyWished: !created },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DELETE /api/wishlist/:productId (idempotent remove) ---------- */
router.delete(
  "/:productId",
  validate(productIdParamSchema, "params"),
  async (req, res, next) => {
    try {
      const result = await Wishlist.deleteOne({
        user: req.user._id,
        product: req.params.productId,
      });
      res.json({
        success: true,
        data: { wished: false, removed: result.deletedCount > 0 },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

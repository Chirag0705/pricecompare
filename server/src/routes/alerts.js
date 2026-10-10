import { Router } from "express";
import { PriceAlert, Product, StoreListing } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createAlertSchema,
  patchAlertSchema,
  idParamSchema,
} from "../schemas/personalSchemas.js";
import { evaluateAlertsForProduct } from "../services/alerts.js";

const router = Router();
router.use(requireAuth);

async function decorateAlerts(alerts) {
  const productIds = alerts.map((a) => a.product?._id ?? a.product);
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
          },
        },
      ])
    : [];
  const priceById = new Map(
    priceRows.map((r) => [String(r._id), r.inStockMin ?? r.anyMin ?? null])
  );

  return alerts.map((a) => {
    const doc = a.toObject ? a.toObject() : a;
    const productId = String(doc.product?._id ?? doc.product);
    const currentPrice = priceById.get(productId) ?? null;
    return {
      id: doc._id,
      targetPrice: doc.targetPrice,
      condition: doc.condition,
      active: doc.active,
      lastTriggeredAt: doc.lastTriggeredAt ?? null,
      lastTriggeredPrice: doc.lastTriggeredPrice ?? null,
      createdAt: doc.createdAt,
      currentPrice,
      targetMet:
        currentPrice !== null && doc.active && currentPrice <= doc.targetPrice,
      product: doc.product
        ? {
            id: doc.product._id,
            title: doc.product.title,
            brand: doc.product.brand,
            image: doc.product.images?.[0] || null,
          }
        : null,
    };
  });
}

/* ---------- POST /api/alerts ---------- */
router.post("/", validate(createAlertSchema), async (req, res, next) => {
  try {
    const { productId, targetPrice } = req.body;

    const product = await Product.findById(productId).select("_id title");
    if (!product) throw ApiError.notFound("Product not found");

    // Identical active alert (same product + target) → return it instead of
    // duplicating; different targets on the same product stay independent.
    const duplicate = await PriceAlert.findOne({
      user: req.user._id,
      product: product._id,
      targetPrice,
      active: true,
    });
    if (duplicate) {
      const [decorated] = await decorateAlerts([
        { ...duplicate.toObject(), product },
      ]);
      return res.status(200).json({
        success: true,
        data: { alert: decorated, alreadyExists: true, triggeredNow: false },
      });
    }

    const alert = await PriceAlert.create({
      user: req.user._id,
      product: product._id,
      targetPrice,
      condition: "below_target",
      active: true,
    });

    // Evaluate immediately: if the target is already met at creation time,
    // the user is notified right away (documented behavior).
    const triggeredNow = (await evaluateAlertsForProduct(product._id)) > 0;
    await alert.populate("product", "title brand images");
    const [decorated] = await decorateAlerts([alert]);

    res.status(201).json({
      success: true,
      data: { alert: decorated, alreadyExists: false, triggeredNow },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/alerts ---------- */
router.get("/", async (req, res, next) => {
  try {
    const alerts = await PriceAlert.find({ user: req.user._id })
      .populate("product", "title brand images")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { alerts: await decorateAlerts(alerts) } });
  } catch (err) {
    next(err);
  }
});

/* ---------- PATCH /api/alerts/:id (pause/resume/retarget) ---------- */
router.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(patchAlertSchema),
  async (req, res, next) => {
    try {
      const alert = await PriceAlert.findOne({ _id: req.params.id, user: req.user._id });
      if (!alert) throw ApiError.notFound("Alert not found");

      if (req.body.active !== undefined) alert.active = req.body.active;
      if (req.body.targetPrice !== undefined) {
        alert.targetPrice = req.body.targetPrice;
        // Retargeting to an already-met target notifies on next evaluation.
        alert.lastTriggeredPrice = undefined;
      }
      await alert.save();
      await alert.populate("product", "title brand images");

      const triggeredNow = (await evaluateAlertsForProduct(alert.product._id)) > 0;
      await alert.populate("product", "title brand images");
      const [decorated] = await decorateAlerts([alert]);

      res.json({ success: true, data: { alert: decorated, triggeredNow } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- DELETE /api/alerts/:id ---------- */
router.delete(
  "/:id",
  validate(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const result = await PriceAlert.deleteOne({
        _id: req.params.id,
        user: req.user._id,
      });
      if (result.deletedCount === 0) throw ApiError.notFound("Alert not found");
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

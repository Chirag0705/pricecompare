import { PriceAlert, Notification, StoreListing, Product } from "../models/index.js";
import { priceEvents } from "./priceEvents.js";
import { logger } from "../utils/logger.js";

function formatINR(amount) {
  return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * Current best price for a product: minimum in-stock listing price,
 * falling back to the minimum price across all listings (mirrors the
 * product-detail summary logic from Phase 4).
 */
export async function bestPriceForProduct(productId) {
  const rows = await StoreListing.aggregate([
    { $match: { product: productId, archived: { $ne: true } } },
    {
      $group: {
        _id: null,
        inStockMin: {
          $min: {
            $cond: [{ $eq: ["$availability", "in_stock"] }, "$currentPrice", null],
          },
        },
        anyMin: { $min: "$currentPrice" },
      },
    },
  ]);
  if (!rows.length) return null;
  return rows[0].inStockMin ?? rows[0].anyMin ?? null;
}

/**
 * Evaluate all active alerts for a product against the current best price.
 * Trigger condition: bestPrice <= targetPrice.
 * Dedup: one notification per alert per distinct price point
 * (lastTriggeredPrice); unchanged prices across sync runs never re-notify.
 * Documented behavior: if a target is already met at evaluation time
 * (including at alert creation), the user is notified immediately.
 * Returns the number of notifications created.
 */
export async function evaluateAlertsForProduct(productId) {
  const alerts = await PriceAlert.find({ product: productId, active: true });
  if (!alerts.length) return 0;

  const bestPrice = await bestPriceForProduct(productId);
  if (bestPrice === null) return 0; // no listings yet — evaluates on future data

  const product = await Product.findById(productId).select("title");
  if (!product) return 0;

  let created = 0;
  for (const alert of alerts) {
    if (bestPrice <= alert.targetPrice && alert.lastTriggeredPrice !== bestPrice) {
      await Notification.create({
        user: alert.user,
        type: "price_drop",
        message: `Price drop: ${product.title} is now ${formatINR(bestPrice)} — at or below your target of ${formatINR(alert.targetPrice)}.`,
        product: product._id,
      });
      alert.lastTriggeredPrice = bestPrice;
      alert.lastTriggeredAt = new Date();
      await alert.save();
      created += 1;
    }
  }
  return created;
}

let hookRegistered = false;

/**
 * Subscribe to the Phase 3 priceChanged hook. Idempotent.
 */
export function registerAlertHook() {
  if (hookRegistered) return;
  hookRegistered = true;
  priceEvents.on("priceChanged", (detail) => {
    evaluateAlertsForProduct(detail.productId).catch((err) => {
      logger.error("Alert evaluation failed", err.stack || err.message);
    });
  });
}

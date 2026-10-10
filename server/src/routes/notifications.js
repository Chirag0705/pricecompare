import { Router } from "express";
import { Notification } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/personalSchemas.js";

const router = Router();
router.use(requireAuth);

/* ---------- GET /api/notifications ---------- */
router.get("/", async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .populate("product", "title brand images")
        .sort({ createdAt: -1 })
        .limit(50),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n._id,
          type: n.type,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt,
          product: n.product
            ? {
                id: n.product._id,
                title: n.product.title,
                brand: n.product.brand,
                image: n.product.images?.[0] || null,
              }
            : null,
        })),
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/notifications/unread-count ---------- */
router.get("/unread-count", async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });
    res.json({ success: true, data: { unreadCount } });
  } catch (err) {
    next(err);
  }
});

/* ---------- PATCH /api/notifications/read-all ---------- */
router.patch("/read-all", async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (err) {
    next(err);
  }
});

/* ---------- PATCH /api/notifications/:id/read ---------- */
router.patch(
  "/:id/read",
  validate(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: { read: true } },
        { new: true }
      );
      if (!notification) throw ApiError.notFound("Notification not found");
      res.json({
        success: true,
        data: { id: notification._id, read: true },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

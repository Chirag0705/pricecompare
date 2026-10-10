import { Router } from "express";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logActivity } from "../services/ingestion.js";
import { validate as validateMW } from "../middleware/validate.js";
import { userListQuerySchema, updateUserSchema } from "../schemas/adminSchemas.js";
import { idParamSchema } from "../schemas/catalogSchemas.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

/* ---------- GET /api/admin/users ---------- */
router.get(
  "/users",
  validateMW(userListQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { q, page, limit, role, status } = req.query;
      const filter = {};
      if (role) filter.role = role;
      if (status === "active") filter.active = true;
      else if (status === "deactivated") filter.active = false;
      if (q) {
        const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        filter.$or = [{ email: rx }, { name: rx }];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select("name email role active createdAt")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        User.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          users,
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

/* ---------- PATCH /api/admin/users/:id ---------- */
router.patch(
  "/users/:id",
  validateMW(idParamSchema, "params"),
  validateMW(updateUserSchema),
  async (req, res, next) => {
    try {
      const target = await User.findById(req.params.id).select("+tokenVersion");
      if (!target) throw ApiError.notFound("User not found");

      const isSelf = String(target._id) === String(req.user._id);
      if (isSelf && req.body.active === false) {
        throw ApiError.badRequest("You cannot deactivate your own account");
      }
      if (isSelf && req.body.role === "user") {
        throw ApiError.badRequest("You cannot demote your own admin role");
      }

      const losesAdmin =
        target.role === "admin" &&
        ((req.body.role === "user") || (req.body.active === false));
      if (losesAdmin) {
        const otherAdmins = await User.countDocuments({
          role: "admin",
          active: true,
          _id: { $ne: target._id },
        });
        if (otherAdmins === 0) {
          throw ApiError.conflict(
            "This is the last active admin. Promote another admin first."
          );
        }
      }

      const fields = {};
      if (req.body.role !== undefined) {
        target.role = req.body.role;
        fields.role = req.body.role;
      }
      if (req.body.active !== undefined) {
        target.active = req.body.active;
        fields.active = req.body.active;
        if (req.body.active === false) {
          target.tokenVersion = (target.tokenVersion ?? 0) + 1;
        }
      }
      await target.save();

      await logActivity("user.update", "User", target._id, {
        email: target.email,
        ...fields,
      }, req.user);

      res.json({
        success: true,
        data: {
          user: {
            id: target._id,
            name: target.name,
            email: target.email,
            role: target.role,
            active: target.active,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

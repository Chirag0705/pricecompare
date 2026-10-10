import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../schemas/authSchemas.js";
import { signToken } from "../utils/jwt.js";

const router = Router();

router.use(requireAuth);

// Minimal admin-only users list (activates requireRole; full user management in Phase 6).
router.get("/", requireRole("admin"), async (_req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select("name email role active createdAt");
    res.json({ success: true, data: { users } });
  } catch (err) {
    next(err);
  }
});

function userPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

router.put("/me", validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const newEmail = email.toLowerCase();

    if (newEmail !== req.user.email) {
      const existing = await User.findOne({ email: newEmail });
      if (existing && !existing._id.equals(req.user._id)) {
        throw ApiError.conflict("This email is already in use", [
          { field: "email", message: "This email is already in use" },
        ]);
      }
    }

    req.user.name = name;
    req.user.email = newEmail;
    await req.user.save();

    res.json({ success: true, data: { user: userPayload(req.user) } });
  } catch (err) {
    next(err);
  }
});

router.put(
  "/me/password",
  validate(changePasswordSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select(
        "+passwordHash +tokenVersion"
      );

      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) {
        throw ApiError.unauthorized("Current password is incorrect");
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await user.save();

      // Issue a fresh token so the current session continues seamlessly
      // while all other sessions (older tokens) become invalid.
      const token = signToken(user);
      res.json({
        success: true,
        data: { token, message: "Password updated" },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

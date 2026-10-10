import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
} from "../schemas/authSchemas.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15 });

function userPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

router.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw ApiError.conflict("An account with this email already exists", [
        { field: "email", message: "This email is already registered" },
      ]);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "user",
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      data: { token, user: userPayload(user) },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash +tokenVersion"
    );

    const genericError = ApiError.unauthorized(
      "Invalid email or password"
    );

    if (!user || !user.passwordHash) {
      throw genericError;
    }
    if (!user.active) {
      throw ApiError.forbidden("This account has been deactivated.");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw genericError;
    }

    const token = signToken(user);
    res.json({
      success: true,
      data: { token, user: userPayload(user) },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, (_req, res) => {
  // Stateless JWT: client discards the token. Password changes invalidate
  // other sessions server-side via tokenVersion.
  res.json({ success: true, data: { message: "Logged out" } });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, data: { user: userPayload(req.user) } });
});

export default router;

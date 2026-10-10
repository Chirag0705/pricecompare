import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/index.js";

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export async function requireAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw ApiError.unauthorized("Authentication required");
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw ApiError.unauthorized("Session expired. Please log in again.");
      }
      throw ApiError.unauthorized("Invalid session. Please log in again.");
    }

    const user = await User.findById(payload.sub).select("+tokenVersion");
    if (!user) {
      throw ApiError.unauthorized("Account not found. Please log in again.");
    }
    if (!user.active) {
      throw ApiError.forbidden("This account has been deactivated.");
    }
    if ((user.tokenVersion ?? 0) !== payload.tv) {
      throw ApiError.unauthorized("Session expired. Please log in again.");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required"));
    }
    if (req.user.role !== role) {
      return next(ApiError.forbidden("You do not have permission to do this"));
    }
    next();
  };
}

/**
 * Attaches req.user when a valid token is present; otherwise continues
 * as a guest without error. Used on public endpoints that personalize
 * responses (e.g. product detail "wishlisted" flag).
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) return next();

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return next();
    }

    const user = await User.findById(payload.sub).select("+tokenVersion");
    if (!user || !user.active || (user.tokenVersion ?? 0) !== payload.tv) {
      return next();
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

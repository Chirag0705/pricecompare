import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    tv: user.tokenVersion ?? 0,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

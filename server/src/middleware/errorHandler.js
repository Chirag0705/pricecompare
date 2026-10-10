import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let error = err;

  if (err.type === "entity.parse.failed") {
    error = ApiError.badRequest("Malformed JSON in request body");
  } else if (err.type === "entity.too.large") {
    error = ApiError.badRequest("Request body too large");
  } else if (err.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.validation("Validation failed", details);
  } else if (err.name === "CastError") {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    error = ApiError.conflict(
      `Duplicate value for: ${fields.join(", ") || "unique field"}`,
      fields.map((f) => ({ field: f, message: "Already in use" }))
    );
  } else if (!(err instanceof ApiError)) {
    logger.error("Unhandled error", err.stack || err.message);
    error = ApiError.internal("Internal server error");
  }

  const payload = {
    success: false,
    error: {
      message: error.message,
      code: error.code || "ERROR",
    },
  };
  if (error.details) payload.error.details = error.details;

  res.status(error.statusCode || 500).json(payload);
}

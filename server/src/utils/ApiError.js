export class ApiError extends Error {
  constructor(statusCode, message, code = "ERROR", details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details) {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message = "Conflict", details) {
    return new ApiError(409, message, "CONFLICT", details);
  }

  static validation(message = "Validation failed", details) {
    return new ApiError(422, message, "VALIDATION_ERROR", details);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }

  static serviceUnavailable(message = "Service unavailable") {
    return new ApiError(503, message, "SERVICE_UNAVAILABLE");
  }
}

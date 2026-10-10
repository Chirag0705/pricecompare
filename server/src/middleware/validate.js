import { ApiError } from "../utils/ApiError.js";

/**
 * Validates req[source] against a Zod schema; replaces it with parsed data on success.
 * Throws 422 VALIDATION_ERROR with field-level details on failure.
 */
export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join(".") || source,
        message: i.message,
      }));
      return next(ApiError.validation("Validation failed", details));
    }
    req[source] = result.data;
    next();
  };
}

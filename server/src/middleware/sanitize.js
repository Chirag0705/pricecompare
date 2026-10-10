/**
 * Strips control characters (except tab/newline) from all string values in
 * req.body and req.query. Applied globally as defense-in-depth; Zod schemas
 * remain the primary validation layer.
 */
export function sanitizeInput() {
  const MAX_DEPTH = 8;

  function cleanString(str) {
    return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  }

  function walk(value, depth) {
    if (depth > MAX_DEPTH || value === null || typeof value !== "object") {
      return typeof value === "string" ? cleanString(value) : value;
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = walk(v, depth + 1);
    }
    return out;
  }

  return (req, _res, next) => {
    if (req.body && typeof req.body === "object") req.body = walk(req.body, 0);
    if (req.query && typeof req.query === "object") {
      // Express 4 defines req.query as a getter — redefine it as a data property.
      Object.defineProperty(req, "query", {
        value: walk(req.query, 0),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    next();
  };
}

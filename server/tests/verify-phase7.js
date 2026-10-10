import mongoose from "mongoose";
import { Product, StoreListing, ActivityLog, Category, Store, User, PriceHistory } from "../src/models/index.js";
import { signToken } from "../src/utils/jwt.js";
import { env } from "../src/config/env.js";
import { rateLimit } from "../src/middleware/rateLimit.js";

const BASE = process.env.API_BASE || "http://localhost:5000/api";

let passed = 0;
let failed = 0;
function ok(label) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}
function fail(label, detail) {
  failed += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}
function assert(cond, label, detail = "") {
  if (cond) ok(label);
  else fail(label, detail);
}

async function api(method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pricecompare");

  console.log("== Phase 7 Advanced Features & Hardening E2E ==\n");

  // ---------- 1. Security headers ----------
  {
    const res = await fetch(`${BASE}/stores`);
    const h = res.headers;
    assert(res.status === 200, "T1 /stores returns 200");
    assert(
      h.get("x-content-type-options") === "nosniff",
      "T1 helmet: X-Content-Type-Options nosniff",
      h.get("x-content-type-options")
    );
    assert(Boolean(h.get("x-frame-options")), "T1 helmet: X-Frame-Options present", h.get("x-frame-options"));
    assert(Boolean(h.get("referrer-policy")), "T1 helmet: Referrer-Policy present", h.get("referrer-policy"));
    assert(!h.get("x-powered-by"), "T1 X-Powered-By disabled");
  }

  // ---------- 2. Global rate limiter unit check ----------
  {
    const limiter = rateLimit({ windowMs: 1000, max: 3 });
    const mkReq = () => ({ ip: "10.0.0.9" });
    let blocked = 0;
    let allowed = 0;
    const mkRes = {};
    for (let i = 0; i < 5; i++) {
      limiter(mkReq(), mkRes, (err) => {
        if (err) blocked += 1;
        else allowed += 1;
      });
    }
    assert(allowed === 3 && blocked === 2, "T2 global rate limiter allows max then blocks", `allowed=${allowed} blocked=${blocked}`);
  }

  // ---------- 3. Input sanitization ----------
  {
    const { status } = await api("GET", "/products/suggestions?q=%00%01iphone%02");
    assert(status === 200 || status === 422, "T3 control chars in query sanitized (no 500)", `status=${status}`);
  }

  // ---------- 4. Suggestions on real data ----------
  let suggestionProductId = null;
  {
    const { status, data } = await api("GET", "/products/suggestions?q=iphone");
    assert(status === 200 && data?.success, "T4 suggestions returns 200");
    const suggestions = data.data.suggestions;
    assert(Array.isArray(suggestions), "T4 suggestions is array");
    assert(suggestions.length > 0, "T4 suggestions non-empty for 'iphone'", `got ${suggestions.length}`);
    if (suggestions.length) {
      const s = suggestions[0];
      assert(Boolean(s.id && s.title), "T4 suggestion has id+title");
      suggestionProductId = String(s.id);
    }

    // fuzzy: mid-string token match
    const fuzzy = await api("GET", "/products/suggestions?q=buds");
    assert(fuzzy.status === 200, "T4 fuzzy suggestions returns 200");

    // no matches → empty array (dropdown hidden client-side)
    const none = await api("GET", "/products/suggestions?q=zzzzqqqxyzzy");
    assert(
      none.status === 200 && none.data.data.suggestions.length === 0,
      "T4 no-match suggestions returns empty array"
    );

    // second identical request → cache HIT
    const hit = await api("GET", "/products/suggestions?q=iphone");
    assert(
      hit.headers.get("x-cache") === "HIT",
      "T4 suggestions cached (X-Cache HIT on 2nd request)",
      hit.headers.get("x-cache")
    );
  }

  // ---------- 5. Search cache HIT + invalidation on mutation ----------
  let adminUser = null;
  let adminToken = null;
  {
    const first = await api("GET", "/products/search?q=iphone&limit=5");
    assert(first.status === 200, "T5 search returns 200");
    assert(first.headers.get("x-cache") === "MISS", "T5 search first request is cache MISS");

    const second = await api("GET", "/products/search?q=iphone&limit=5");
    assert(second.headers.get("x-cache") === "HIT", "T5 search second request is cache HIT");

    const third = await api("GET", "/products/search?q=iphone&limit=5&sort=price_asc");
    assert(third.headers.get("x-cache") === "MISS", "T5 different query params = different cache key");

    // Invalidate via real admin mutation
    adminUser = await User.findOne({ email: "admin@pricecompare.local" }).select("+tokenVersion");
    assert(Boolean(adminUser), "T5 admin user exists");
    adminToken = signToken(adminUser);

    const productList = await api("GET", "/admin/products?limit=1", { token: adminToken });
    const pid = productList.data?.data?.products?.[0]?._id;
    assert(Boolean(pid), "T5 admin products list returns a product for mutation test");

    if (pid) {
      const upd = await api("PUT", `/admin/products/${pid}`, {
        token: adminToken,
        body: { brand: productList.data.data.products[0].brand || "TestBrand" },
      });
      assert(upd.status === 200, "T5 admin product update succeeds", JSON.stringify(upd.data));

      const after = await api("GET", "/products/search?q=iphone&limit=5");
      assert(
        after.headers.get("x-cache") === "MISS",
        "T5 cache invalidated after admin mutation (MISS)",
        after.headers.get("x-cache")
      );
      const afterHit = await api("GET", "/products/search?q=iphone&limit=5");
      assert(afterHit.headers.get("x-cache") === "HIT", "T5 cache repopulates after invalidation");
    }
  }

  // ---------- 6. Categories + stores caching ----------
  {
    const c1 = await api("GET", "/categories");
    assert(c1.status === 200 && c1.headers.get("x-cache") === "MISS", "T6 categories first request MISS");
    const c2 = await api("GET", "/categories");
    assert(c2.headers.get("x-cache") === "HIT", "T6 categories second request HIT");

    const s2 = await api("GET", "/stores");
    assert(
      s2.headers.get("x-cache") === "HIT" || s2.headers.get("x-cache") === "MISS",
      "T6 stores returns X-Cache header",
      s2.headers.get("x-cache")
    );
    const s3 = await api("GET", "/stores");
    assert(s3.headers.get("x-cache") === "HIT", "T6 stores cached (HIT)", s3.headers.get("x-cache"));
  }

  // ---------- 7. Price-history caching ----------
  {
    const pid = suggestionProductId || String((await Product.findOne({ archived: { $ne: true } }).select("_id"))._id);
    const p1 = await api("GET", `/products/${pid}/price-history?days=90`);
    assert(p1.status === 200 && p1.headers.get("x-cache") === "MISS", "T7 price-history first request MISS");
    const p2 = await api("GET", `/products/${pid}/price-history?days=90`);
    assert(p2.headers.get("x-cache") === "HIT", "T7 price-history second request HIT");
  }

  // ---------- 8. Recommendations: related + trending ----------
  let t8ProductId = null;
  {
    const product = await Product.findOne({ archived: { $ne: true } }).select("_id title brand category");
    assert(Boolean(product), "T8 a product exists for recommendations test");
    t8ProductId = String(product._id);
    const { status, data } = await api("GET", `/products/${product._id}/recommendations`);
    assert(status === 200 && data?.success, "T8 recommendations returns 200");
    const { related, trending, trendingFallback } = data.data;
    assert(Array.isArray(related), "T8 related is array");
    assert(Array.isArray(trending), "T8 trending is array");
    assert(typeof trendingFallback === "boolean", "T8 trendingFallback is boolean");
    assert(
      related.every((r) => String(r.id) !== String(product._id)),
      "T8 related excludes the current product"
    );
    assert(
      related.every((r) => Boolean(r.id && r.title && "bestPrice" in r)),
      "T8 related items have id/title/bestPrice"
    );
    assert(
      trending.every((r) => String(r.id) !== String(product._id)),
      "T8 trending excludes the current product"
    );

    // 404 for unknown id
    const missing = await api("GET", "/products/000000000000000000000000/recommendations");
    assert(missing.status === 404, "T8 recommendations 404 for unknown product", `status=${missing.status}`);

    // invalid id → validation error
    const bad = await api("GET", "/products/not-an-id/recommendations");
    assert(bad.status === 422, "T8 recommendations validates id param", `status=${bad.status}`);
  }

  // ---------- 9. Admin price-updates N+1 fix (batched, has delta) ----------
  {
    // Ensure at least some price history exists
    const historyCount = await PriceHistory.countDocuments();
    const { status, data } = await api("GET", "/admin/prices/updates?limit=10", { token: adminToken });
    assert(status === 200 && data?.success, "T9 admin prices/updates returns 200");
    const updates = data.data.updates;
    assert(Array.isArray(updates), "T9 updates is array");
    if (historyCount > 0 && updates.length) {
      assert(
        updates.every((u) => "previousPrice" in u && "delta" in u),
        "T9 every update row has previousPrice + delta fields"
      );
    }
    assert(typeof data.data.total === "number", "T9 total is number");
  }

  // ---------- 10. Auth rate limiting still strict ----------
  {
    // /auth/login has its own 15/15min limiter — a couple of bad logins should not break it.
    const r = await api("POST", "/auth/login", { body: { email: "nobody@test.local", password: "wrongpass1" } });
    assert(r.status === 401 || r.status === 429, "T10 bad login rejected", `status=${r.status}`);
  }

  // ---------- 11. Health endpoint reports and skips rate limit ----------
  {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert(res.status === 200 && data?.success, "T11 health returns 200");
  }

  // ---------- 12. Search suggestion edge cases ----------
  {
    const empty = await api("GET", "/products/suggestions?q=");
    assert(empty.status === 422, "T12 empty q rejected by validation", `status=${empty.status}`);
    const long = await api("GET", `/products/suggestions?q=${"a".repeat(300)}`);
    assert(long.status === 422, "T12 over-long q rejected", `status=${long.status}`);
  }

  // ---------- 13. Recommendations cache (fresh product not touched in T8) ----------
  {
    const product = await Product.findOne({
      archived: { $ne: true },
      _id: { $ne: t8ProductId },
    })
      .select("_id")
      .sort({ createdAt: -1 });
    const r1 = await api("GET", `/products/${product._id}/recommendations`);
    assert(r1.headers.get("x-cache") === "MISS", "T13 recommendations first request MISS", r1.headers.get("x-cache"));
    const r2 = await api("GET", `/products/${product._id}/recommendations`);
    assert(r2.headers.get("x-cache") === "HIT", "T13 recommendations second request HIT");
  }

  // ---------- 14. CORS lockdown: disallowed origin gets no ACAO header ----------
  {
    const res = await fetch(`${BASE}/stores`, { headers: { Origin: "http://evil.example" } });
    assert(
      !res.headers.get("access-control-allow-origin"),
      "T14 CORS rejects disallowed origin (no ACAO header)",
      res.headers.get("access-control-allow-origin")
    );
    const good = await fetch(`${BASE}/stores`, { headers: { Origin: env.CORS_ORIGIN } });
    assert(
      good.headers.get("access-control-allow-origin") === env.CORS_ORIGIN,
      "T14 CORS allows configured origin"
    );
  }

  console.log(`\n== Results: ${passed} passed, ${failed} failed ==`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

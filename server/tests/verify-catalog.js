import mongoose from "mongoose";
import { Product, StoreListing, ActivityLog, Category, Store } from "../src/models/index.js";

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

async function api(method, path, { redirect } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: redirect || "follow",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers, body: data };
}

function assert(cond, label, detail = "") {
  if (cond) ok(label);
  else fail(label, detail);
}

async function main() {
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pricecompare"
  );

  console.log("== Phase 4 Catalog E2E ==\n");

  // --- T1: GET /api/stores ---
  {
    const { status, data } = await api("GET", "/stores");
    assert(status === 200 && data?.success, "T1 stores endpoint returns 200");
    const slugs = data.data.stores.map((s) => s.slug);
    assert(
      slugs.includes("amazon") && slugs.includes("flipkart") && slugs.includes("myntra"),
      "T1 stores include amazon/flipkart/myntra",
      JSON.stringify(slugs)
    );
  }

  // --- T2: GET /api/categories tree ---
  let electronicsId = null;
  {
    const { status, data } = await api("GET", "/categories");
    assert(status === 200 && data?.success, "T2 categories endpoint returns 200");
    const roots = data.data.categories;
    assert(roots.length === 3, "T2 3 root categories", `got ${roots.length}`);
    const electronics = roots.find((c) => c.slug === "electronics");
    electronicsId = electronics?._id;
    assert(
      electronics && electronics.children.length === 4,
      "T2 electronics has 4 children",
      `children: ${electronics?.children?.length}`
    );
    assert(
      electronics?.children?.some((c) => c.slug === "laptops"),
      "T2 electronics.children includes laptops"
    );
  }

  // --- T3: search q=iphone ---
  let iphoneId = null;
  {
    const { status, data } = await api("GET", "/products/search?q=iphone");
    assert(status === 200 && data?.success, "T3 search returns 200");
    const items = data.data.items;
    assert(items.length >= 1, "T3 q=iphone returns results", `got ${items.length}`);
    const iphone = items.find((i) => i.title.includes("iPhone 15"));
    iphoneId = iphone?.id;
    assert(!!iphone, "T3 iPhone 15 in results");
    assert(
      iphone && typeof iphone.bestPrice === "number" && iphone.listingCount === 2,
      "T3 iPhone has bestPrice and 2 listings",
      JSON.stringify(iphone && { bestPrice: iphone.bestPrice, listingCount: iphone.listingCount })
    );
    assert(
      iphone && typeof iphone.storeCount === "number" && iphone.hasStock === true,
      "T3 iPhone has storeCount and hasStock"
    );
    assert(data.data.total >= 1 && data.data.page === 1, "T3 pagination meta present");
  }

  // --- T4: sorting ---
  {
    const { data } = await api("GET", "/products/search?sort=price_asc&limit=50");
    const prices = data.data.items.map((i) => i.bestPrice);
    const asc = prices.every((p, i) => i === 0 || p >= prices[i - 1]);
    assert(asc, "T4 price_asc sorted ascending", JSON.stringify(prices.slice(0, 5)));
    assert(
      data.data.items[0].title.includes("Airdopes 141"),
      "T4 cheapest is boAt Airdopes 141",
      data.data.items[0].title
    );

    const desc = await api("GET", "/products/search?sort=price_desc&limit=50");
    const dprices = desc.data.data.items.map((i) => i.bestPrice);
    const dsc = dprices.every((p, i) => i === 0 || p <= dprices[i - 1]);
    assert(dsc, "T4 price_desc sorted descending");

    const disc = await api("GET", "/products/search?sort=discount&limit=50");
    const discounts = disc.data.data.items.map((i) => i.maxDiscount ?? 0);
    const dcr = discounts.every((d, i) => i === 0 || d <= discounts[i - 1]);
    assert(dcr, "T4 discount sorted descending", JSON.stringify(discounts));

    const newest = await api("GET", "/products/search?sort=newest&limit=50");
    assert(newest.status === 200 && newest.data.data.items.length === 12, "T4 newest returns all 12");
  }

  // --- T5: brand filter ---
  {
    const { data } = await api("GET", "/products/search?brand=boAt&limit=50");
    const items = data.data.items;
    assert(items.length === 2, "T5 brand=boAt returns 2 products", `got ${items.length}`);
    assert(
      items.every((i) => i.brand.toLowerCase() === "boat"),
      "T5 all results brand boAt"
    );
    assert(
      data.data.availableBrands.some((b) => b.brand.toLowerCase() === "boat"),
      "T5 availableBrands facet includes boAt"
    );
    assert(
      data.data.availableBrands.some((b) => b.brand === "Apple"),
      "T5 facet still lists other brands while brand filter active",
      JSON.stringify(data.data.availableBrands)
    );

    const caseTest = await api("GET", "/products/search?brand=SONY&limit=50");
    assert(
      caseTest.data.data.items.length === 1,
      "T5 brand filter case-insensitive (SONY)"
    );
  }

  // --- T6: category filter (parent includes descendants) ---
  {
    const { data } = await api("GET", "/products/search?category=laptops&limit=50");
    assert(data.data.items.length === 2, "T6 laptops category has 2 products", `got ${data.data.items.length}`);
    assert(
      data.data.items.some((i) => i.title.includes("Victus")) &&
        data.data.items.some((i) => i.title.includes("MacBook")),
      "T6 laptops = Victus + MacBook"
    );

    const parent = await api("GET", "/products/search?category=electronics&limit=50");
    const parentCount = parent.data.data.items.length;
    assert(parentCount === 8, "T6 parent electronics includes descendants (8)", `got ${parentCount}`);
    assert(parent.data.data.category?.slug === "electronics", "T6 response echoes category");
  }

  // --- T7: store filter ---
  {
    const { data } = await api("GET", "/products/search?store=myntra&limit=50");
    assert(
      data.data.items.length >= 4,
      "T7 store=myntra returns products sold on Myntra",
      `got ${data.data.items.length}`
    );
    const nike = data.data.items.find((i) => i.title.includes("Air Max"));
    assert(!!nike, "T7 Nike Air Max available on Myntra");

    const bad = await api("GET", "/products/search?store=not-a-store");
    assert(bad.status === 404, "T7 unknown store slug → 404", `got ${bad.status}`);
  }

  // --- T8: availability filter ---
  {
    const { data } = await api("GET", "/products/search?availability=in_stock&limit=50");
    assert(
      data.data.items.every((i) => i.hasStock === true),
      "T8 in_stock filter → every result hasStock"
    );
    assert(data.data.items.length === 12, "T8 all seeded products have stock", `got ${data.data.items.length}`);
  }

  // --- T9: price range filter ---
  {
    const { data } = await api("GET", "/products/search?minPrice=1000&maxPrice=2500&limit=50");
    const titles = data.data.items.map((i) => i.title);
    assert(
      data.data.items.every((i) => i.bestPrice >= 1000 && i.bestPrice <= 2500),
      "T9 price range respected"
    );
    assert(
      titles.some((t) => t.includes("Airdopes")) && titles.some((t) => t.includes("Rockerz")),
      "T9 Airdopes + Rockerz in range",
      JSON.stringify(titles)
    );
    assert(
      !titles.some((t) => t.includes("iPhone")),
      "T9 iPhone excluded from range"
    );
  }

  // --- T10: pagination ---
  {
    const p1 = await api("GET", "/products/search?page=1&limit=5");
    assert(p1.data.data.items.length === 5, "T10 page1 limit5 → 5 items");
    assert(p1.data.data.total === 12 && p1.data.data.totalPages === 3, "T10 total=12 totalPages=3");
    const p3 = await api("GET", "/products/search?page=3&limit=5");
    assert(p3.data.data.items.length === 2, "T10 page3 → 2 items", `got ${p3.data.data.items.length}`);
    const p99 = await api("GET", "/products/search?page=99&limit=5");
    assert(p99.data.data.items.length === 0, "T10 page99 → empty items");
  }

  // --- T11: empty + invalid queries ---
  {
    const none = await api("GET", "/products/search?q=zzzznotfoundzzz");
    assert(
      none.status === 200 && none.data.data.items.length === 0 && none.data.data.total === 0,
      "T11 no results → total 0"
    );
    const longQ = await api("GET", `/products/search?q=${"a".repeat(201)}`);
    assert(longQ.status === 422, "T11 q>200 chars → 422", `got ${longQ.status}`);
    const badSort = await api("GET", "/products/search?sort=hacker");
    assert(badSort.status === 422, "T11 invalid sort → 422");
    const badCat = await api("GET", "/products/search?category=nope");
    assert(badCat.status === 404, "T11 unknown category → 404");
  }

  // --- T12: product detail (multi-store: boAt Airdopes, 3 stores) ---
  {
    const product = await Product.findOne({ model: "Airdopes 141" });
    const { status, data } = await api("GET", `/products/${product._id}`);
    assert(status === 200 && data?.success, "T12 product detail 200");
    const d = data.data;
    assert(d.listings.length === 3, "T12 3 store listings", `got ${d.listings.length}`);
    const prices = d.listings.map((l) => l.currentPrice);
    assert(
      prices[0] <= prices[1] && prices[1] <= prices[2],
      "T12 listings sorted by price asc",
      JSON.stringify(prices)
    );
    assert(d.summary.bestPrice === 1099, "T12 bestPrice = 1099", `got ${d.summary.bestPrice}`);
    assert(d.summary.maxMrp === 4490, "T12 maxMrp = 4490", `got ${d.summary.maxMrp}`);
    assert(d.summary.savings === 3391, "T12 savings = 3391", `got ${d.summary.savings}`);
    assert(d.summary.storeCount === 3 && d.summary.hasStock === true, "T12 storeCount=3 hasStock");
    const fields = ["store", "url", "currentPrice", "mrp", "discountPercent", "availability", "deliveryInfo", "lastSyncedAt"];
    assert(
      d.listings.every((l) => fields.every((f) => l[f] !== undefined)),
      "T12 all comparison fields present (appidea.md)"
    );
    assert(
      d.listings.every((l) => l.store?.name && l.store?.slug),
      "T12 store populated on listings"
    );
    assert(d.product.brand === "boAt" && d.product.model === "Airdopes 141", "T12 product fields");
  }

  // --- T13: single-listing product ---
  {
    const product = await Product.findOne({ model: "Galaxy Tab A9" });
    const { data } = await api("GET", `/products/${product._id}`);
    assert(data.data.listings.length === 1, "T13 single listing renders");
    assert(data.data.summary.bestPrice === 16999, "T13 single listing bestPrice");
  }

  // --- T14: invalid product id ---
  {
    const bad = await api("GET", "/products/not-an-id");
    assert(bad.status === 422 || bad.status === 404, "T14 malformed id handled", `got ${bad.status}`);
    const missing = await api(
      "GET",
      `/products/${new mongoose.Types.ObjectId()}`
    );
    assert(missing.status === 404, "T14 unknown ObjectId → 404", `got ${missing.status}`);
  }

  // --- T15: price history ---
  {
    const product = await Product.findOne({ model: "iPhone 15" });
    const { status, data } = await api(
      "GET",
      `/products/${product._id}/price-history?days=90`
    );
    assert(status === 200 && data?.success, "T15 price history 200");
    const points = data.data.points;
    assert(points.length >= 2, "T15 iPhone has >=2 daily points", `got ${points.length}`);
    assert(
      points.every((p) => p.date && typeof p.minPrice === "number" && p.minPrice <= p.maxPrice),
      "T15 points have date/minPrice<=maxPrice"
    );
    const sorted = points.every((p, i) => i === 0 || p.date >= points[i - 1].date);
    assert(sorted, "T15 points sorted by date asc");

    const badDays = await api("GET", `/products/${product._id}/price-history?days=999`);
    assert(badDays.status === 422, "T15 days>365 → 422");

    const missing = await api(
      "GET",
      `/products/${new mongoose.Types.ObjectId()}/price-history`
    );
    assert(missing.status === 404, "T15 unknown product → 404");
  }

  // --- T16: /go/:listingId redirect + click log ---
  {
    const product = await Product.findOne({ model: "iPhone 15" });
    const amazonStore = await Store.findOne({ slug: "amazon" });
    const listing = await StoreListing.findOne({ product: product._id, store: amazonStore._id });
    const before = await ActivityLog.countDocuments({ action: "click.buy_now" });

    const res = await fetch(`${BASE}/go/${listing._id}`, { redirect: "manual" });
    assert(res.status === 302, "T16 /go returns 302", `got ${res.status}`);
    const loc = res.headers.get("location") || "";
    assert(
      loc.includes("amazon.in") && loc.includes("tag=pricecompare-21"),
      "T16 location is affiliate URL",
      loc
    );

    const after = await ActivityLog.countDocuments({ action: "click.buy_now" });
    assert(after === before + 1, "T16 click logged in ActivityLog", `${before}→${after}`);

    const log = await ActivityLog.findOne({ action: "click.buy_now" }).sort({ createdAt: -1 });
    assert(
      log && log.entityType === "StoreListing" && log.metadata?.productId,
      "T16 log has entityType + productId metadata"
    );

    const missing = await fetch(`${BASE}/go/${new mongoose.Types.ObjectId()}`, { redirect: "manual" });
    assert(missing.status === 404, "T16 unknown listing → 404");

    const malformed = await fetch(`${BASE}/go/nope`, { redirect: "manual" });
    assert(malformed.status === 422 || malformed.status === 404, "T16 malformed listing id handled");
  }

  // --- T17: OOS product edge (Rockerz 450) ---
  {
    const product = await Product.findOne({ model: "Rockerz 450" });
    const { data } = await api("GET", `/products/${product._id}`);
    const oos = data.data.listings.filter((l) => l.availability === "out_of_stock");
    assert(oos.length === 1, "T17 Rockerz has 1 OOS listing");
    assert(data.data.summary.bestPrice === 1499, "T17 bestPrice falls back to in-stock (1499)", `got ${data.data.summary.bestPrice}`);
  }

  console.log(`\n== Result: ${passed} passed, ${failed} failed ==`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

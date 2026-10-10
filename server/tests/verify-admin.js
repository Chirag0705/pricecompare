import mongoose from "mongoose";
import {
  Product,
  Store,
  StoreListing,
  Category,
  Wishlist,
  PriceAlert,
  Notification,
  PriceHistory,
  DataQualityIssue,
  User,
  ActivityLog,
} from "../src/models/index.js";
import { ingestListing } from "../src/services/ingestion.js";

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

async function api(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function registerUser(tag) {
  const email = `p6-${tag}-${Date.now()}@itest.local`;
  const res = await api("POST", "/auth/register", {
    body: { name: `P6 ${tag}`, email, password: "Str0ngPass!9" },
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.data.token, user: res.data.data.user, email };
}

const ADMIN_EMAIL = "admin@pricecompare.local";
const ADMIN_PASSWORD = "AdminPass123!";

async function main() {
  console.log("PHASE 6 ADMIN VERIFICATION");
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pricecompare"
  );

  const adminLogin = await api("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status}`);
  }
  const adminToken = adminLogin.data.data.token;
  const regular = await registerUser("regular");
  const userToken = regular.token;
  console.log("  Setup: admin + regular user ready");

  // Clean leftovers from any prior interrupted run
  const stale = await Product.find({
    $or: [
      { brand: { $in: ["P6Brand", "P6BrandUpdated", "P6MergeBrand", "P6MutBrand", "P6StoreBrand"] } },
      { title: /^P6 / },
      { title: /^P6MANUAL/ },
    ],
  }).select("_id");
  const staleIds = stale.map((p) => p._id);
  if (staleIds.length) {
    await StoreListing.deleteMany({ product: { $in: staleIds } });
    await PriceHistory.deleteMany({ product: { $in: staleIds } });
    await Wishlist.deleteMany({ product: { $in: staleIds } });
    await PriceAlert.deleteMany({ product: { $in: staleIds } });
    await Notification.deleteMany({ product: { $in: staleIds } });
    await Product.deleteMany({ _id: { $in: staleIds } });
    await Store.deleteMany({ slug: /^p6-test-store-/ });
    await Category.deleteMany({ slug: /^p6-/ });
    console.log(`  Cleanup: removed ${staleIds.length} stale product(s) from prior runs`);
  }
  console.log("");

  /* ---------- T1: authz on every admin family ---------- */
  console.log("T1 — Auth & authorization");
  const adminGets = [
    "/admin/stats",
    "/admin/products",
    "/admin/listings",
    "/admin/stores",
    "/admin/categories",
    "/admin/users",
    "/admin/prices",
    "/admin/prices/updates",
    "/admin/activity",
    "/admin/sync/jobs",
    "/admin/sync/adapters",
    "/admin/data-issues",
  ];
  let all401 = true;
  for (const p of adminGets) {
    const r = await api("GET", p);
    if (r.status !== 401) {
      all401 = false;
      fail(`Unauth 401: GET ${p}`, `got ${r.status}`);
    }
  }
  assert(all401, "All admin GETs return 401 without token");

  let all403 = true;
  for (const p of adminGets) {
    const r = await api("GET", p, { token: userToken });
    if (r.status !== 403) {
      all403 = false;
      fail(`Non-admin 403: GET ${p}`, `got ${r.status}`);
    }
  }
  assert(all403, "All admin GETs return 403 for regular user");

  const post403 = await api("POST", "/admin/products", {
    token: userToken,
    body: { title: "Evil Product" },
  });
  assert(post403.status === 403, "Non-admin POST /admin/products → 403", `got ${post403.status}`);

  const del403 = await api("DELETE", `/admin/listings/${new mongoose.Types.ObjectId()}`, {
    token: userToken,
  });
  assert(del403.status === 403, "Non-admin DELETE /admin/listings/:id → 403", `got ${del403.status}`);

  /* ---------- T2: stats ---------- */
  console.log("\nT2 — Dashboard stats");
  const stats = await api("GET", "/admin/stats", { token: adminToken });
  assert(stats.status === 200, "GET /admin/stats → 200", `got ${stats.status}`);
  const s = stats.data?.data;
  assert(typeof s?.products === "number", "stats.products is a number");
  assert(typeof s?.listings === "number", "stats.listings is a number");
  assert(typeof s?.openIssues === "number", "stats.openIssues is a number");
  assert(typeof s?.clicks === "number", "stats.clicks is a number");
  assert(Array.isArray(s?.recentActivity), "stats.recentActivity is an array");

  /* ---------- T3: manual product create → public search ---------- */
  console.log("\nT3 — Manual product creation & public search");
  const tag = `P6MANUAL${Date.now()}`;
  const createRes = await api("POST", "/admin/products", {
    token: adminToken,
    body: {
      title: `${tag} Manual Admin Phone 512GB`,
      brand: "P6Brand",
      model: "M512",
      identifiers: { gtin: `P6GTIN${Date.now()}` },
      images: ["https://example.com/p6-manual.jpg"],
      specs: { Color: "Black" },
    },
  });
  assert(createRes.status === 201, "POST /admin/products → 201", `got ${createRes.status}`);
  const manualId = createRes.data?.data?.product?._id || createRes.data?.data?.product?.id;
  assert(Boolean(manualId), "Manual product has id");

  const search = await api("GET", `/products/search?q=${tag}`);
  assert(search.status === 200, "Public search → 200");
  const found = (search.data?.data?.items || []).some(
    (i) => String(i.id) === String(manualId)
  );
  assert(found, "Manually created product appears in public search");

  const upd = await api("PUT", `/admin/products/${manualId}`, {
    token: adminToken,
    body: { brand: "P6BrandUpdated", title: `${tag} Manual Admin Phone 512GB v2` },
  });
  assert(upd.status === 200, "PUT /admin/products/:id → 200", `got ${upd.status}`);
  assert(
    upd.data?.data?.product?.brand === "P6BrandUpdated",
    "Product update persisted"
  );

  const prodActivity = await api("GET", "/admin/activity?action=product.create", {
    token: adminToken,
  });
  assert(prodActivity.status === 200, "Activity filter action=product.create → 200");
  const hasCreateLog = (prodActivity.data?.data?.entries || []).some(
    (e) => String(e.entityId) === String(manualId)
  );
  assert(hasCreateLog, "product.create appears in activity log");

  /* ---------- T4: merge (listings + refs moved, source archived) ---------- */
  console.log("\nT4 — Product merge");
  const amazon = await Store.findOne({ slug: "amazon" }).lean();
  assert(Boolean(amazon), "Amazon store exists (seeded)");

  const srcListing = {
    storeProductId: `P6SRC-${Date.now()}`,
    url: "https://example.com/p6-src",
    title: `P6 Merge Source Widget Alpha ${Date.now()}`,
    brand: "P6MergeBrand",
    model: "SRC-1",
    gtin: `P6MERGESRC${Date.now()}`,
    images: ["https://example.com/p6-src.jpg"],
    price: 1999,
    mrp: 2499,
    availability: "in_stock",
  };
  const srcOutcome = await ingestListing(amazon._id, srcListing);
  assert(
    srcOutcome.outcome === "created" || srcOutcome.outcome === "unmatched",
    "Source listing ingested",
    JSON.stringify(srcOutcome)
  );
  const srcProductId = srcOutcome.productId;

  const tgtListing = {
    storeProductId: `P6TGT-${Date.now()}`,
    url: "https://example.com/p6-tgt",
    title: `P6 Merge Target Widget Beta ${Date.now()}`,
    brand: "P6MergeBrand",
    model: "TGT-1",
    images: ["https://example.com/p6-tgt.jpg"],
    price: 2099,
    mrp: 2599,
    availability: "in_stock",
  };
  const tgtOutcome = await ingestListing(amazon._id, tgtListing);
  const tgtProductId = tgtOutcome.productId;

  // Create dependent refs on the SOURCE product before merging
  const refUser = regular.user.id || regular.user._id;
  await Wishlist.create({ user: refUser, product: srcProductId });
  const alert = await PriceAlert.create({
    user: refUser,
    product: srcProductId,
    targetPrice: 1500,
  });
  const notifMessage = `P6 merge ref test ${Date.now()}`;
  await Notification.create({
    user: refUser,
    type: "system",
    message: notifMessage,
    product: srcProductId,
  });

  const mergeRes = await api("POST", "/admin/products/merge", {
    token: adminToken,
    body: { sourceId: srcProductId, targetId: tgtProductId },
  });
  assert(mergeRes.status === 200, "POST /admin/products/merge → 200", `got ${mergeRes.status} ${JSON.stringify(mergeRes.data)}`);
  const moved = mergeRes.data?.data?.merged;
  assert((moved?.movedListings ?? 0) >= 1, "At least one listing moved", JSON.stringify(moved));

  const srcAfter = await Product.findById(srcProductId).lean();
  assert(srcAfter?.archived === true, "Source product archived after merge");
  const srcListingCount = await StoreListing.countDocuments({ product: srcProductId });
  assert(srcListingCount === 0, "Source has zero listings after merge");
  const tgtListingCount = await StoreListing.countDocuments({ product: tgtProductId });
  assert(tgtListingCount >= 2, "Target holds both listings", `got ${tgtListingCount}`);

  const wishAfter = await Wishlist.findOne({ user: refUser, product: tgtProductId });
  assert(Boolean(wishAfter), "Wishlist ref moved to target");
  const alertAfter = await PriceAlert.findById(alert._id).lean();
  assert(String(alertAfter?.product) === String(tgtProductId), "PriceAlert ref moved to target");
  const notifAfter = await Notification.findOne({ message: notifMessage }).lean();
  assert(String(notifAfter?.product) === String(tgtProductId), "Notification ref moved to target");

  const srcDetail = await api("GET", `/products/${srcProductId}`);
  assert(srcDetail.status === 404, "Archived product detail → 404 on public API", `got ${srcDetail.status}`);

  /* ---------- T5: identifier conflict prevents merge ---------- */
  console.log("\nT5 — Merge conflict validation");
  const cA = await Product.create({
    title: "P6 Conflict Product A",
    normalizedTitle: "p6 conflict product a",
    identifiers: { gtin: "P6CONFLICT-A" },
  });
  const cB = await Product.create({
    title: "P6 Conflict Product B",
    normalizedTitle: "p6 conflict product b",
    identifiers: { gtin: "P6CONFLICT-B" },
  });
  const conflict = await api("POST", "/admin/products/merge", {
    token: adminToken,
    body: { sourceId: cA._id, targetId: cB._id },
  });
  assert(conflict.status === 409, "Conflicting identifiers → 409", `got ${conflict.status}`);
  const sameMerge = await api("POST", "/admin/products/merge", {
    token: adminToken,
    body: { sourceId: cA._id, targetId: cA._id },
  });
  assert(sameMerge.status === 400, "Merging product into itself → 400", `got ${sameMerge.status}`);
  await Product.deleteMany({ _id: { $in: [cA._id, cB._id] } });

  /* ---------- T6: listings management ---------- */
  console.log("\nT6 — Listing management");
  const listingsRes = await api("GET", "/admin/listings?limit=5", { token: adminToken });
  assert(listingsRes.status === 200, "GET /admin/listings → 200");
  assert(Array.isArray(listingsRes.data?.data?.listings), "listings array present");

  // Ingest a dedicated listing to mutate
  const mutListing = {
    storeProductId: `P6MUT-${Date.now()}`,
    url: "https://example.com/p6-mut",
    title: `P6 Mutable Listing Widget ${Date.now()}`,
    brand: "P6MutBrand",
    model: "MUT-1",
    gtin: `P6MUT${Date.now()}`,
    images: ["https://example.com/p6-mut.jpg"],
    price: 999,
    mrp: 1299,
    availability: "in_stock",
  };
  const mutOutcome = await ingestListing(amazon._id, mutListing);
  const mutListingDoc = await StoreListing.findOne({
    store: amazon._id,
    storeProductId: mutListing.storeProductId,
  }).lean();
  assert(Boolean(mutListingDoc), "Mutable listing exists");

  const priceUpd = await api("PUT", `/admin/listings/${mutListingDoc._id}`, {
    token: adminToken,
    body: { currentPrice: 899 },
  });
  assert(priceUpd.status === 200, "PUT /admin/listings/:id → 200", `got ${priceUpd.status}`);
  const afterPrice = await StoreListing.findById(mutListingDoc._id).lean();
  assert(afterPrice?.currentPrice === 899, "Listing price updated to 899");
  assert(
    afterPrice?.discountPercent !== undefined && afterPrice?.discountPercent > 0,
    "discountPercent recalculated",
    `got ${afterPrice?.discountPercent}`
  );

  const attach = await api("POST", `/admin/listings/${mutListingDoc._id}/attach`, {
    token: adminToken,
    body: { productId: manualId },
  });
  assert(attach.status === 200, "POST /admin/listings/:id/attach → 200", `got ${attach.status}`);
  const afterAttach = await StoreListing.findById(mutListingDoc._id).lean();
  assert(
    String(afterAttach?.product) === String(manualId),
    "Listing attached to manual product"
  );

  const attachBad = await api("POST", `/admin/listings/${mutListingDoc._id}/attach`, {
    token: adminToken,
    body: { productId: new mongoose.Types.ObjectId() },
  });
  assert(attachBad.status === 400, "Attach to missing product → 400", `got ${attachBad.status}`);

  // Ingested listing has price history → soft-archive
  const delListing = await api("DELETE", `/admin/listings/${mutListingDoc._id}`, {
    token: adminToken,
  });
  assert(
    delListing.status === 200 && delListing.data?.data?.archived === true,
    "DELETE listing with history → soft-archive (archived:true)",
    `got ${delListing.status} ${JSON.stringify(delListing.data)}`
  );
  const archivedListing = await StoreListing.findById(mutListingDoc._id).lean();
  assert(archivedListing?.archived === true, "Listing archived flag persisted");
  const detailAfterArchive = await api("GET", `/products/${manualId}`);
  const stillVisible = (detailAfterArchive.data?.data?.listings || []).some(
    (l) => String(l.id) === String(mutListingDoc._id)
  );
  assert(!stillVisible, "Archived listing hidden from public product detail");

  const goArchived = await fetch(`${BASE}/go/${mutListingDoc._id}`, { redirect: "manual" });
  assert(goArchived.status === 404, "GET /go for archived listing → 404", `got ${goArchived.status}`);

  // Listing without price history → hard delete
  const bareListing = await StoreListing.create({
    product: manualId,
    store: amazon._id,
    storeProductId: `P6BARE-${Date.now()}`,
    url: "https://example.com/p6-bare",
    currentPrice: 500,
    mrp: 600,
    availability: "in_stock",
  });
  const delBare = await api("DELETE", `/admin/listings/${bareListing._id}`, {
    token: adminToken,
  });
  assert(
    delBare.status === 200 && delBare.data?.data?.deleted === true,
    "DELETE listing without history → hard delete",
    `got ${delBare.status} ${JSON.stringify(delBare.data)}`
  );
  const bareGone = await StoreListing.findById(bareListing._id).lean();
  assert(!bareGone, "Hard-deleted listing removed from DB");

  /* ---------- T7: stores CRUD + disable hides listings publicly ---------- */
  console.log("\nT7 — Store management & propagation");
  const storeSlug = `p6-test-store-${Date.now()}`;
  const createStore = await api("POST", "/admin/stores", {
    token: adminToken,
    body: {
      name: "P6 Test Store",
      slug: storeSlug,
      domain: "https://p6test.example.com",
      active: true,
      affiliateConfig: { paramStyle: "query", template: "https://p6test.example.com/item?tag=pc-21" },
    },
  });
  assert(createStore.status === 201, "POST /admin/stores → 201", `got ${createStore.status}`);
  const testStoreId = createStore.data?.data?.store?._id;

  const testListing = {
    storeProductId: `P6TSTORE-${Date.now()}`,
    url: "https://p6test.example.com/item/1",
    title: `P6 TestStore Exclusive Router AX ${Date.now()}`,
    brand: "P6StoreBrand",
    model: "AX-1",
    gtin: `P6TSTORE${Date.now()}`,
    images: ["https://example.com/p6-router.jpg"],
    price: 3499,
    mrp: 4299,
    availability: "in_stock",
  };
  const tOutcome = await ingestListing(testStoreId, testListing);
  assert(Boolean(tOutcome.productId), "Listing ingested on test store");

  const detailBefore = await api("GET", `/products/${tOutcome.productId}`);
  assert(
    (detailBefore.data?.data?.listings || []).length === 1,
    "Test product detail shows the listing while store active"
  );

  const disable = await api("PUT", `/admin/stores/${testStoreId}`, {
    token: adminToken,
    body: { active: false },
  });
  assert(disable.status === 200, "Store disabled via PUT → 200");

  const detailAfter = await api("GET", `/products/${tOutcome.productId}`);
  assert(
    (detailAfter.data?.data?.listings || []).length === 0,
    "Disabled store's listings hidden from public product detail"
  );

  const goListing = await StoreListing.findOne({
    store: testStoreId,
    storeProductId: testListing.storeProductId,
  }).lean();
  const goRes = await fetch(`${BASE}/go/${goListing._id}`, { redirect: "manual" });
  assert(goRes.status === 404, "GET /go for disabled-store listing → 404", `got ${goRes.status}`);

  const deleteWithListings = await api("DELETE", `/admin/stores/${testStoreId}`, {
    token: adminToken,
  });
  assert(deleteWithListings.status === 409, "Delete store with listings → 409", `got ${deleteWithListings.status}`);

  await api("PUT", `/admin/stores/${testStoreId}`, {
    token: adminToken,
    body: { active: true },
  });
  const detailReenabled = await api("GET", `/products/${tOutcome.productId}`);
  assert(
    (detailReenabled.data?.data?.listings || []).length === 1,
    "Re-enabled store's listings visible again"
  );

  // Cleanup: remove test store listing then delete store
  await StoreListing.deleteMany({ store: testStoreId });
  const delStore = await api("DELETE", `/admin/stores/${testStoreId}`, {
    token: adminToken,
  });
  assert(delStore.status === 200, "Delete empty store → 200");

  /* ---------- T8: categories CRUD + delete guards ---------- */
  console.log("\nT8 — Category management");
  const catSlug = `p6-cat-${Date.now()}`;
  const createCat = await api("POST", "/admin/categories", {
    token: adminToken,
    body: { name: "P6 Test Category", slug: catSlug },
  });
  assert(createCat.status === 201, "POST /admin/categories → 201", `got ${createCat.status}`);
  const catId = createCat.data?.data?.category?._id;

  const catUpd = await api("PUT", `/admin/categories/${catId}`, {
    token: adminToken,
    body: { name: "P6 Test Category Renamed" },
  });
  assert(catUpd.status === 200, "PUT /admin/categories/:id → 200");
  assert(catUpd.data?.data?.category?.name === "P6 Test Category Renamed", "Category rename persisted");

  // Assign manual product to category, then delete should be blocked
  await api("PUT", `/admin/products/${manualId}`, {
    token: adminToken,
    body: { category: catId },
  });
  const delCatBlocked = await api("DELETE", `/admin/categories/${catId}`, {
    token: adminToken,
  });
  assert(delCatBlocked.status === 409, "Delete category with products → 409", `got ${delCatBlocked.status}`);

  // Unblock and delete
  const unassign = await api("PUT", `/admin/products/${manualId}`, {
    token: adminToken,
    body: { category: null },
  });
  assert(unassign.status === 200, "PUT category:null → 200", `got ${unassign.status}`);
  const delCat = await api("DELETE", `/admin/categories/${catId}`, {
    token: adminToken,
  });
  assert(delCat.status === 200, "Delete empty category → 200", `got ${delCat.status}`);

  // Child guard
  const parentCat = await Category.create({ name: "P6 Parent", slug: `p6-parent-${Date.now()}` });
  const childCat = await Category.create({
    name: "P6 Child",
    slug: `p6-child-${Date.now()}`,
    parent: parentCat._id,
  });
  const delParent = await api("DELETE", `/admin/categories/${parentCat._id}`, {
    token: adminToken,
  });
  assert(delParent.status === 409, "Delete category with children → 409", `got ${delParent.status}`);
  await Category.deleteMany({ _id: { $in: [parentCat._id, childCat._id] } });

  /* ---------- T9: user management ---------- */
  console.log("\nT9 — User management");
  const usersRes = await api("GET", "/admin/users?limit=50", { token: adminToken });
  assert(usersRes.status === 200, "GET /admin/users → 200");
  const listed = (usersRes.data?.data?.users || []).some(
    (u) => u.email === regular.email
  );
  assert(listed, "Registered user appears in admin user list");

  const deactivateSelf = await api("PATCH", `/admin/users/${adminLogin.data.data.user.id}`, {
    token: adminToken,
    body: { active: false },
  });
  assert(deactivateSelf.status === 400, "Deactivate self → 400", `got ${deactivateSelf.status}`);

  const demoteSelf = await api("PATCH", `/admin/users/${adminLogin.data.data.user.id}`, {
    token: adminToken,
    body: { role: "user" },
  });
  assert(demoteSelf.status === 400, "Demote self → 400", `got ${demoteSelf.status}`);

  // Create a second admin directly (no public register-as-admin path)
  const secondAdmin = await User.create({
    name: "P6 Second Admin",
    email: `p6-admin2-${Date.now()}@itest.local`,
    passwordHash: "x",
    role: "admin",
    active: true,
  });
  const demoteOther = await api("PATCH", `/admin/users/${secondAdmin._id}`, {
    token: adminToken,
    body: { role: "user" },
  });
  assert(demoteOther.status === 200, "Demote another admin → 200", `got ${demoteOther.status}`);

  // Now only one active admin remains — demoting that one should fail? There's still main admin active.
  // Deactivate second (now user) account.
  const deactivateOther = await api("PATCH", `/admin/users/${secondAdmin._id}`, {
    token: adminToken,
    body: { active: false },
  });
  assert(deactivateOther.status === 200, "Deactivate another user → 200", `got ${deactivateOther.status}`);
  const afterDeact = await User.findById(secondAdmin._id).select("+tokenVersion").lean();
  assert(afterDeact?.active === false, "Deactivation persisted");
  assert(
    (afterDeact?.tokenVersion ?? 0) >= 1,
    "tokenVersion bumped on deactivation (sessions invalidated)"
  );

  const regularDeact = await api("PATCH", `/admin/users/${regular.user.id || regular.user._id}`, {
    token: adminToken,
    body: { active: false },
  });
  assert(regularDeact.status === 200, "Deactivate regular user → 200");
  await User.deleteOne({ _id: secondAdmin._id });

  /* ---------- T10: prices views ---------- */
  console.log("\nT10 — Price data views");
  const prices = await api("GET", "/admin/prices?sort=discount&limit=10", { token: adminToken });
  assert(prices.status === 200, "GET /admin/prices → 200");
  assert(Array.isArray(prices.data?.data?.listings), "prices listings array present");
  const priceItem = (prices.data?.data?.listings || [])[0];
  if (priceItem) {
    assert("anomaly" in priceItem, "anomaly field present on price rows");
  } else {
    ok("anomaly field present on price rows (no rows — vacuous pass)");
  }

  const updates = await api("GET", "/admin/prices/updates?limit=5", { token: adminToken });
  assert(updates.status === 200, "GET /admin/prices/updates → 200");
  const updItem = (updates.data?.data?.updates || [])[0];
  if (updItem) {
    assert("delta" in updItem && "previousPrice" in updItem, "updates include delta + previousPrice");
  } else {
    ok("updates include delta + previousPrice (no rows — vacuous pass)");
  }

  /* ---------- T11: activity feed ---------- */
  console.log("\nT11 — Activity log");
  const activity = await api("GET", "/admin/activity?limit=100", { token: adminToken });
  assert(activity.status === 200, "GET /admin/activity → 200");
  const mergeAct = await api("GET", "/admin/activity?action=product.merge&limit=25", {
    token: adminToken,
  });
  assert(mergeAct.status === 200, "Activity filter action=product.merge → 200");
  const actions = new Set([
    ...(activity.data?.data?.entries || []).map((e) => e.action),
    ...(mergeAct.data?.data?.entries || []).map((e) => e.action),
  ]);
  assert(actions.has("product.create"), "product.create in activity feed");
  assert(actions.has("product.merge"), "product.merge in activity feed");
  assert(actions.has("listing.update"), "listing.update in activity feed");
  assert(actions.has("store.create"), "store.create in activity feed");
  assert(actions.has("user.update"), "user.update in activity feed");

  const actorOk = (activity.data?.data.entries || []).every(
    (e) => !e.actor || (e.actor.name && e.actor.email)
  );
  assert(actorOk, "Activity entries have populated actor or null");

  /* ---------- T12: DQ issues (Phase 3 queue consumed by matching UI) ---------- */
  console.log("\nT12 — Data quality issue resolution");
  const issue = await DataQualityIssue.create({
    type: "ambiguous_match",
    description: "P6 test ambiguous issue",
    status: "open",
    product: manualId,
  });
  const issuesList = await api("GET", "/admin/data-issues?status=open&limit=100", {
    token: adminToken,
  });
  assert(issuesList.status === 200, "GET /admin/data-issues → 200");
  const listedIssue = (issuesList.data?.data?.issues || []).some(
    (i) => String(i._id) === String(issue._id)
  );
  assert(listedIssue, "Open issue appears in queue");

  const resolve = await api("PATCH", `/admin/data-issues/${issue._id}`, {
    token: adminToken,
    body: { status: "resolved", resolution: "P6 manual review done" },
  });
  assert(resolve.status === 200, "PATCH /admin/data-issues/:id → 200");
  const resolvedIssue = await DataQualityIssue.findById(issue._id).lean();
  assert(resolvedIssue?.status === "resolved", "Issue status persisted as resolved");

  /* ---------- T13: sync jobs UI endpoints (Phase 3 regression via UI paths) ---------- */
  console.log("\nT13 — Sync job monitoring endpoints");
  const adapters = await api("GET", "/admin/sync/adapters", { token: adminToken });
  assert(adapters.status === 200, "GET /admin/sync/adapters → 200");
  assert(Array.isArray(adapters.data?.data?.adapters), "adapters array present");

  const jobs = await api("GET", "/admin/sync/jobs?limit=5", { token: adminToken });
  assert(jobs.status === 200, "GET /admin/sync/jobs → 200");

  /* ---------- cleanup ---------- */
  const leftovers = await Product.find({
    $or: [
      { brand: { $in: ["P6Brand", "P6BrandUpdated", "P6MergeBrand", "P6MutBrand", "P6StoreBrand"] } },
      { title: /^P6 / },
      { title: /^P6MANUAL/ },
    ],
  }).select("_id");
  const leftoverIds = leftovers.map((p) => p._id);
  if (leftoverIds.length) {
    await StoreListing.deleteMany({ product: { $in: leftoverIds } });
    await PriceHistory.deleteMany({ product: { $in: leftoverIds } });
    await Wishlist.deleteMany({ product: { $in: leftoverIds } });
    await PriceAlert.deleteMany({ product: { $in: leftoverIds } });
    await Notification.deleteMany({ product: { $in: leftoverIds } });
    await Product.deleteMany({ _id: { $in: leftoverIds } });
  }
  await Store.deleteMany({ slug: /^p6-test-store-/ });
  await Category.deleteMany({ slug: /^p6-/ });
  await Wishlist.deleteMany({ user: refUser });
  await PriceAlert.deleteMany({ user: refUser });
  await Notification.deleteMany({ user: refUser, message: /^P6 merge ref test/ });

  await mongoose.disconnect();
  console.log(`\n== Result: ${passed} passed, ${failed} failed ==`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("FATAL:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

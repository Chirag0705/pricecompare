import mongoose from "mongoose";
import {
  Product,
  Store,
  StoreListing,
  PriceHistory,
  Wishlist,
  PriceAlert,
  Notification,
  DataQualityIssue,
  User,
} from "../src/models/index.js";
import { ingestListing } from "../src/services/ingestion.js";
import { registerAlertHook } from "../src/services/alerts.js";

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
  const email = `p5-${tag}-${Date.now()}@itest.local`;
  const res = await api("POST", "/auth/register", {
    body: { name: `P5 ${tag}`, email, password: "Str0ngPass!9" },
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.data.token, user: res.data.data.user, email };
}

async function waitFor(fn, timeoutMs = 3000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

const itestListing = {
  storeProductId: "ITEST-P5-001",
  url: "https://example.com/itest-p5",
  title: "ITEST P5 Pro Watch Sapphire",
  brand: "ITESTBrand",
  model: "P5W",
  gtin: "ITESTP5GTIN001",
  images: ["https://example.com/itest-p5.jpg"],
  color: "Sapphire",
  specs: { Warranty: "1 Year" },
  price: 5000,
  mrp: 6000,
  availability: "in_stock",
  deliveryInfo: { eta: "2 days", cost: "Free" },
};

async function cleanup(userEmails, productTitle) {
  const products = await Product.find({ title: productTitle });
  const ids = products.map((p) => p._id);
  await StoreListing.deleteMany({ product: { $in: ids } });
  await PriceHistory.deleteMany({ product: { $in: ids } });
  await Product.deleteMany({ _id: { $in: ids } });
  await DataQualityIssue.deleteMany({ product: { $in: ids } });
  const users = await User.find({ email: { $in: userEmails } });
  const userIds = users.map((u) => u._id);
  await Wishlist.deleteMany({ user: { $in: userIds } });
  await PriceAlert.deleteMany({ user: { $in: userIds } });
  await Notification.deleteMany({ user: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

async function main() {
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pricecompare"
  );
  registerAlertHook();

  console.log("== Phase 5 Wishlist/Alerts/Notifications E2E ==\n");

  const userA = await registerUser("a");
  const userB = await registerUser("b");
  const amazon = await Store.findOne({ slug: "amazon" });

  // Seed an ITEST product through the production pipeline.
  const created = await ingestListing(amazon._id, itestListing);
  assert(created.outcome === "created", "setup: ITEST product created via ingestion");
  const productId = String(created.productId);
  const productObjectId = new mongoose.Types.ObjectId(productId);

  let notifCountBefore = 0;

  // --- T1: Wishlist ---
  {
    const unauth = await api("GET", "/wishlist");
    assert(unauth.status === 401, "T1 unauth GET /wishlist → 401");

    const unauthPost = await api("POST", `/wishlist/${productId}`);
    assert(unauthPost.status === 401, "T1 unauth POST /wishlist → 401");

    const add = await api("POST", `/wishlist/${productId}`, { token: userA.token });
    assert(
      add.status === 201 && add.data.data.wished === true && add.data.data.alreadyWished === false,
      "T1 add → 201 wished=true",
      JSON.stringify(add.data)
    );

    const addAgain = await api("POST", `/wishlist/${productId}`, { token: userA.token });
    assert(
      addAgain.status === 200 && addAgain.data.data.alreadyWished === true,
      "T1 add again → 200 alreadyWished (idempotent)"
    );
    const count = await Wishlist.countDocuments({ user: userA.user.id, product: productObjectId });
    assert(count === 1, "T1 no duplicate wishlist row", `count=${count}`);

    const list = await api("GET", "/wishlist", { token: userA.token });
    assert(list.status === 200 && list.data.data.items.length === 1, "T1 GET returns 1 item");
    const item = list.data.data.items[0];
    assert(
      item.product.id === productId && item.bestPrice === 5000 && item.listingCount === 1,
      "T1 item has product + bestPrice 5000",
      JSON.stringify(item)
    );

    const detailAuthed = await api("GET", `/products/${productId}`, { token: userA.token });
    assert(detailAuthed.data.data.wishlisted === true, "T1 product detail wishlisted=true (authed)");
    const detailGuest = await api("GET", `/products/${productId}`);
    assert(detailGuest.data.data.wishlisted === false, "T1 product detail wishlisted=false (guest)");

    const del = await api("DELETE", `/wishlist/${productId}`, { token: userA.token });
    assert(del.status === 200 && del.data.data.wished === false && del.data.data.removed === true, "T1 remove → wished=false");
    const delAgain = await api("DELETE", `/wishlist/${productId}`, { token: userA.token });
    assert(delAgain.data.data.removed === false, "T1 remove again → removed=false (idempotent)");

    const badId = await api("POST", "/wishlist/not-an-id", { token: userA.token });
    assert(badId.status === 422, "T1 malformed productId → 422");
    const missing = await api("POST", `/wishlist/${new mongoose.Types.ObjectId()}`, { token: userA.token });
    assert(missing.status === 404, "T1 unknown product → 404");
  }

  // --- T2: Alerts CRUD + immediate trigger ---
  {
    const unauth = await api("POST", "/alerts", {
      body: { productId, targetPrice: 4000 },
    });
    assert(unauth.status === 401, "T2 unauth POST /alerts → 401");

    // Target below current (5000) → not met at creation.
    const notMet = await api("POST", "/alerts", {
      body: { productId, targetPrice: 4000 },
      token: userA.token,
    });
    assert(
      notMet.status === 201 && notMet.data.data.triggeredNow === false && notMet.data.data.alert.active === true,
      "T2 alert below current → created, not triggered",
      JSON.stringify(notMet.data)
    );
    const alertAId = notMet.data.data.alert.id;

    // Target already met at creation → notify immediately (documented).
    notifCountBefore = await Notification.countDocuments({ user: userA.user.id });
    const met = await api("POST", "/alerts", {
      body: { productId, targetPrice: 6000 },
      token: userA.token,
    });
    assert(
      met.status === 201 && met.data.data.triggeredNow === true,
      "T2 target already met at creation → triggeredNow",
      JSON.stringify(met.data)
    );
    const immediateNotif = await Notification.findOne({
      user: userA.user.id,
      type: "price_drop",
      product: productObjectId,
    });
    assert(!!immediateNotif && immediateNotif.message.includes("5,000"), "T2 immediate notification created");
    const alertBId = met.data.data.alert.id;

    // Duplicate identical active alert → returns existing.
    const dup = await api("POST", "/alerts", {
      body: { productId, targetPrice: 6000 },
      token: userA.token,
    });
    assert(
      dup.status === 200 && dup.data.data.alreadyExists === true && dup.data.data.alert.id === alertBId,
      "T2 identical active alert → deduplicated"
    );

    // Independent second alert on same product.
    const second = await api("POST", "/alerts", {
      body: { productId, targetPrice: 4800 },
      token: userA.token,
    });
    assert(
      second.status === 201 && second.data.data.alert.id !== alertAId,
      "T2 multiple alerts on same product are independent"
    );

    const list = await api("GET", "/alerts", { token: userA.token });
    assert(list.status === 200 && list.data.data.alerts.length === 3, "T2 GET lists 3 alerts");
    const decorated = list.data.data.alerts.find((a) => a.id === alertAId);
    assert(
      decorated.currentPrice === 5000 && decorated.targetMet === false && decorated.product.title.includes("ITEST"),
      "T2 alert decorated with currentPrice + product",
      JSON.stringify(decorated)
    );

    // Pause / resume.
    const pause = await api("PATCH", `/alerts/${alertAId}`, {
      body: { active: false },
      token: userA.token,
    });
    assert(pause.status === 200 && pause.data.data.alert.active === false, "T2 pause");
    const resume = await api("PATCH", `/alerts/${alertAId}`, {
      body: { active: true },
      token: userA.token,
    });
    assert(resume.status === 200 && resume.data.data.alert.active === true, "T2 resume");

    // Validation.
    const negative = await api("POST", "/alerts", {
      body: { productId, targetPrice: -5 },
      token: userA.token,
    });
    assert(negative.status === 422, "T2 negative target → 422");
    const zero = await api("POST", "/alerts", {
      body: { productId, targetPrice: 0 },
      token: userA.token,
    });
    assert(zero.status === 422, "T2 zero target → 422");
    const missingProduct = await api("POST", "/alerts", {
      body: { productId: new mongoose.Types.ObjectId(), targetPrice: 100 },
      token: userA.token,
    });
    assert(missingProduct.status === 404, "T2 unknown product → 404");
    const emptyPatch = await api("PATCH", `/alerts/${alertAId}`, {
      body: {},
      token: userA.token,
    });
    assert(emptyPatch.status === 422, "T2 empty PATCH → 422");

    // Ownership: user B cannot touch user A's alert.
    const foreignPatch = await api("PATCH", `/alerts/${alertAId}`, {
      body: { active: false },
      token: userB.token,
    });
    assert(foreignPatch.status === 404, "T2 foreign PATCH → 404");
    const foreignDelete = await api("DELETE", `/alerts/${alertBId}`, { token: userB.token });
    assert(foreignDelete.status === 404, "T2 foreign DELETE → 404");

    // Delete.
    const del = await api("DELETE", `/alerts/${alertBId}`, { token: userA.token });
    assert(del.status === 200, "T2 delete own alert");
    const delAgain = await api("DELETE", `/alerts/${alertBId}`, { token: userA.token });
    assert(delAgain.status === 404, "T2 delete again → 404");
  }

  // --- T3: real ingest price drop → notification (Phase 3 hook) ---
  {
    // Clean slate for counting: user A still has alertA (4000) + second (4800).
    // Drop alertA's target via retarget to 4500 so the drop to 4200 meets it.
    await api("PATCH", `/alerts/${(await PriceAlert.findOne({ user: userA.user.id, targetPrice: 4000 }))._id}`, {
      body: { targetPrice: 4500 },
      token: userA.token,
    });

    const before = await Notification.countDocuments({
      user: userA.user.id,
      product: productObjectId,
    });

    // REAL price drop through the production ingestion pipeline.
    const drop = await ingestListing(amazon._id, { ...itestListing, price: 4200 });
    assert(drop.outcome === "updated", "T3 price drop ingested");

    const newNotif = await waitFor(async () => {
      const n = await Notification.countDocuments({
        user: userA.user.id,
        product: productObjectId,
      });
      return n > before ? n : null;
    });
    assert(newNotif !== null, "T3 notification created after real price drop", `before=${before}`);

    const notif = await Notification.findOne({
      user: userA.user.id,
      product: productObjectId,
      message: { $regex: "4,200" },
    });
    assert(!!notif && notif.type === "price_drop" && notif.read === false, "T3 notification content + unread");

    const alertA = await PriceAlert.findOne({ user: userA.user.id, targetPrice: 4500 });
    assert(
      alertA.lastTriggeredPrice === 4200 && !!alertA.lastTriggeredAt,
      "T3 alert lastTriggeredPrice=4200",
      `last=${alertA.lastTriggeredPrice}`
    );

    // Re-ingest the SAME price → no event, no duplicate notification (criterion 4).
    const beforeDup = await Notification.countDocuments({
      user: userA.user.id,
      product: productObjectId,
    });
    await ingestListing(amazon._id, { ...itestListing, price: 4200 });
    await new Promise((r) => setTimeout(r, 500));
    const afterDup = await Notification.countDocuments({
      user: userA.user.id,
      product: productObjectId,
    });
    assert(afterDup === beforeDup, "T3 unchanged price → no duplicate notification", `${beforeDup}→${afterDup}`);

    // A distinct new low (4100) re-triggers the same alert.
    await ingestListing(amazon._id, { ...itestListing, price: 4100 });
    const retrigger = await waitFor(async () => {
      const n = await Notification.countDocuments({
        user: userA.user.id,
        product: productObjectId,
        message: { $regex: "4,100" },
      });
      return n > 0;
    });
    assert(retrigger, "T3 distinct new low re-triggers alert");
  }

  // --- T4: notifications ---
  {
    const unauth = await api("GET", "/notifications");
    assert(unauth.status === 401, "T4 unauth GET → 401");

    const list = await api("GET", "/notifications", { token: userA.token });
    assert(list.status === 200 && list.data.data.notifications.length >= 2, "T4 list returns notifications");
    const unread = list.data.data.unreadCount;
    const dbUnread = await Notification.countDocuments({ user: userA.user.id, read: false });
    assert(unread === dbUnread && unread >= 2, "T4 unreadCount matches DB", `${unread} vs ${dbUnread}`);

    const newest = list.data.data.notifications[0];
    const sorted = list.data.data.notifications.every(
      (n, i, arr) => i === 0 || arr[i - 1].createdAt >= n.createdAt
    );
    assert(sorted, "T4 newest first");

    // Mark one read.
    const read = await api("PATCH", `/notifications/${newest.id}/read`, { token: userA.token });
    assert(read.status === 200 && read.data.data.read === true, "T4 mark read");
    const countAfter = await api("GET", "/notifications/unread-count", { token: userA.token });
    assert(countAfter.data.data.unreadCount === unread - 1, "T4 unread decremented");

    // Mark all read.
    const all = await api("PATCH", "/notifications/read-all", { token: userA.token });
    assert(all.status === 200 && all.data.data.updated >= 1, "T4 read-all");
    const zero = await api("GET", "/notifications/unread-count", { token: userA.token });
    assert(zero.data.data.unreadCount === 0, "T4 unread=0 after read-all");

    // Ownership.
    const foreignNotif = await Notification.findOne({ user: userA.user.id });
    const foreign = await api("PATCH", `/notifications/${foreignNotif._id}/read`, {
      token: userB.token,
    });
    assert(foreign.status === 404, "T4 foreign mark-read → 404");
    const bCount = await api("GET", "/notifications/unread-count", { token: userB.token });
    assert(bCount.data.data.unreadCount === 0, "T4 user B sees own (empty) inbox");
  }

  // --- T5: product with no listings keeps alert (edge case) ---
  {
    const orphan = await Product.create({
      title: "ITEST P5 NoListing Gadget",
      brand: "ITESTBrand",
      normalizedTitle: "itest p5 nolisting gadget",
    });
    const alert = await api("POST", "/alerts", {
      body: { productId: String(orphan._id), targetPrice: 100 },
      token: userA.token,
    });
    assert(alert.status === 201 && alert.data.data.triggeredNow === false, "T5 alert on listing-less product persists");
    const list = await api("GET", "/alerts", { token: userA.token });
    const entry = list.data.data.alerts.find((a) => a.product?.title?.includes("NoListing"));
    assert(entry && entry.currentPrice === null && entry.targetMet === false, "T5 currentPrice null, not met");
    await api("DELETE", `/alerts/${alert.data.data.alert.id}`, { token: userA.token });
    await Product.deleteOne({ _id: orphan._id });
  }

  await cleanup([userA.email, userB.email], itestListing.title);

  console.log(`\n== Result: ${passed} passed, ${failed} failed ==`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

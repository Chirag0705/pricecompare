import mongoose from "mongoose";
import {
  Product,
  Store,
  StoreListing,
  PriceHistory,
  DataQualityIssue,
  SyncJob,
  User,
} from "../src/models/index.js";
import { ingestListing, ingestBatch } from "../src/services/ingestion.js";
import { priceEvents } from "../src/services/priceEvents.js";
import { triggerSync, startScheduler, stopScheduler } from "../src/services/scheduler.js";

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

async function cleanup() {
  const marker = /ITEST/;
  const products = await Product.find({ title: marker });
  const ids = products.map((p) => p._id);
  await StoreListing.deleteMany({ product: { $in: ids } });
  await PriceHistory.deleteMany({ product: { $in: ids } });
  await Product.deleteMany({ _id: { $in: ids } });
  await DataQualityIssue.deleteMany({
    $or: [
      { description: marker },
      { "product": { $in: ids } },
    ],
  });
}

const priceEventsSeen = [];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pricecompare");
  priceEvents.on("priceChanged", (e) => priceEventsSeen.push(e));

  const amazon = await Store.findOne({ slug: "amazon" });
  const flipkart = await Store.findOne({ slug: "flipkart" });
  const myntra = await Store.findOne({ slug: "myntra" });

  await cleanup();

  console.log("== Phase 3 Ingestion E2E ==\n");

  // --- T1: new product discovery ---
  const baseListing = {
    storeProductId: "ITEST-ASIN-001",
    url: "https://example.com/itest-phone",
    title: "ITEST Pro Phone X1 256GB",
    brand: "ITESTBrand",
    model: "X1",
    gtin: "1111111111111",
    images: ["https://example.com/img1.jpg"],
    color: "Black",
    specs: { ram: "8GB" },
    price: 1000,
    mrp: 1200,
    availability: "in_stock",
  };

  const r1 = await ingestListing(amazon._id, { ...baseListing });
  if (r1.outcome === "created" && r1.productId) ok("T1 new product created");
  else fail("T1", JSON.stringify(r1));

  const p1 = await Product.findById(r1.productId);
  const l1 = await StoreListing.find({ product: r1.productId });
  const h1 = await PriceHistory.find({ product: r1.productId });
  if (l1.length === 1 && l1[0].currentPrice === 1000 && l1[0].discountPercent === 17)
    ok("T1 listing persisted with price 1000 + discount 17%");
  else fail("T1 listing", JSON.stringify(l1));
  if (h1.length === 1 && h1[0].price === 1000)
    ok("T1 initial price history recorded");
  else fail("T1 history", JSON.stringify(h1));

  // --- T8 early: malformed listing rejected ---
  const r8 = await ingestListing(amazon._id, {
    storeProductId: "ITEST-BAD",
    url: "https://example.com/bad",
    title: "",
    price: -5,
  });
  if (r8.outcome === "invalid") ok("T8 malformed listing rejected (invalid)");
  else fail("T8", JSON.stringify(r8));
  const badIssue = await DataQualityIssue.findOne({ type: "invalid_data", description: /ITEST-BAD|Rejected malformed/ });
  if (badIssue) ok("T8 invalid_data issue opened");
  else fail("T8 DQ", "no invalid_data issue found");
  const badListing = await StoreListing.findOne({ storeProductId: "ITEST-BAD" });
  if (!badListing) ok("T8 malformed listing not persisted");
  else fail("T8 persist", "bad listing was persisted");

  // --- T2: same GTIN from Flipkart attaches to SAME product ---
  const r2 = await ingestListing(flipkart._id, {
    ...baseListing,
    storeProductId: "ITEST-FK-001",
    url: "https://example.com/itest-phone-fk",
    title: "ITEST Pro Phone X1 (256 GB, Black)",
    price: 950,
    mrp: 1200,
  });
  if (r2.outcome === "updated" && String(r2.productId) === String(r1.productId))
    ok("T2 same GTIN → same product (cross-store match)");
  else fail("T2", JSON.stringify(r2));
  const l2 = await StoreListing.find({ product: r1.productId });
  if (l2.length === 2) ok("T2 product now has 2 listings");
  else fail("T2 listings", `count=${l2.length}`);

  // --- T3: Myntra matches via brand+model+color → 3 listings one product ---
  const r3 = await ingestListing(myntra._id, {
    ...baseListing,
    storeProductId: "ITEST-MYN-001",
    url: "https://example.com/itest-phone-myn",
    title: "ITEST Pro Phone X1 Black",
    gtin: undefined,
    price: 1100,
  });
  if (r3.outcome === "updated" && String(r3.productId) === String(r1.productId))
    ok("T3 brand+model+variant match → same product");
  else fail("T3", JSON.stringify(r3));
  const l3 = await StoreListing.find({ product: r1.productId }).populate("store", "slug");
  if (l3.length === 3 && new Set(l3.map((x) => x.store.slug)).size === 3)
    ok("T3 CRITERION: one Product, 3 StoreListings (amazon+flipkart+myntra)");
  else fail("T3 criterion", `listings=${l3.length} stores=${l3.map((x) => x.store.slug)}`);

  // --- T4: price change → history + event (counted per-listing) ---
  const amazonListing = await StoreListing.findOne({
    store: amazon._id,
    storeProductId: "ITEST-ASIN-001",
  });
  const beforeEvents = priceEventsSeen.length;
  await ingestListing(amazon._id, { ...baseListing, price: 900 });
  const h4 = await PriceHistory.find({ listing: amazonListing._id }).sort({
    capturedAt: 1,
  });
  if (h4.length === 2 && h4[1].price === 900)
    ok("T4 price change appended to PriceHistory");
  else fail("T4 history", `count=${h4.length} last=${h4[h4.length - 1]?.price}`);
  if (priceEventsSeen.length > beforeEvents) ok("T4 priceChanged event emitted");
  else fail("T4 event", "no event emitted");

  // --- T5: unchanged price → no new history ---
  const beforeH = await PriceHistory.countDocuments({ listing: amazonListing._id });
  await ingestListing(amazon._id, { ...baseListing, price: 900 });
  const afterH = await PriceHistory.countDocuments({ listing: amazonListing._id });
  if (beforeH === afterH)
    ok("T5 CRITERION: unchanged price creates no history entry");
  else fail("T5", `${beforeH} → ${afterH}`);

  // --- T6: idempotent re-run, no duplicates ---
  const productsBefore = await Product.countDocuments({ title: /ITEST Pro Phone/ });
  const listingsBefore = await StoreListing.countDocuments({ product: r1.productId });
  await ingestBatch(amazon, [baseListing, { ...baseListing, price: 900 }]);
  await ingestBatch(flipkart, [{ ...baseListing, storeProductId: "ITEST-FK-001", url: "https://example.com/itest-phone-fk", price: 950 }]);
  const productsAfter = await Product.countDocuments({ title: /ITEST Pro Phone/ });
  const listingsAfter = await StoreListing.countDocuments({ product: r1.productId });
  if (productsBefore === productsAfter && listingsBefore === listingsAfter)
    ok("T6 CRITERION: re-run creates no duplicates");
  else fail("T6", `products ${productsBefore}→${productsAfter}, listings ${listingsBefore}→${listingsAfter}`);

  // --- T7: ambiguous match (sim ~0.83, no exact identifiers/model) → DQ queue ---
  const r7 = await ingestListing(amazon._id, {
    ...baseListing,
    storeProductId: "ITEST-AMBIG-001",
    url: "https://example.com/itest-ambiguous",
    title: "ITEST Pro Phone X1 256GB with Case",
    gtin: undefined,
    model: undefined,
    price: 1050,
  });
  const ambIssue = await DataQualityIssue.findOne({
    type: "ambiguous_match",
    description: /ITEST/,
  }).populate("suggested", "title");
  if (r7.outcome === "unmatched" && ambIssue && ambIssue.suggested)
    ok("T7 CRITERION: ambiguous match → DQ queue with suggestion (no auto-merge)");
  else fail("T7", `outcome=${r7.outcome} issue=${!!ambIssue}`);
  if (r7.productId && String(r7.productId) !== String(r1.productId))
    ok("T7 ambiguous listing quarantined on its own product");
  else fail("T7 quarantine", `productId=${r7.productId}`);

  // --- T9: availability update ---
  await ingestListing(flipkart._id, {
    ...baseListing,
    storeProductId: "ITEST-FK-001",
    url: "https://example.com/itest-phone-fk",
    price: 950,
    availability: "out_of_stock",
  });
  const fkListing = await StoreListing.findOne({ storeProductId: "ITEST-FK-001" });
  if (fkListing?.availability === "out_of_stock")
    ok("T9 out-of-stock upstream → availability updated");
  else fail("T9", fkListing?.availability);

  // --- T8b: criterion 8 searchability ---
  const found = await Product.find({
    $text: { $search: "ITEST Pro Phone" },
  }).select("title");
  if (found.some((p) => p.title.includes("ITEST Pro Phone")))
    ok("T8b CRITERION: new products are text-searchable");
  else fail("T8b search", JSON.stringify(found));

  // --- Admin APIs ---
  const login = await api("POST", "/auth/login", {
    body: {
      email: process.env.ADMIN_EMAIL || "admin@pricecompare.local",
      password: process.env.ADMIN_PASSWORD || "AdminPass123!",
    },
  });
  const adminToken = login.data?.data?.token;

  // Regular user 403
  const userReg = await api("POST", "/auth/register", {
    body: {
      name: "Not Admin",
      email: `notadmin_${Date.now()}@example.com`,
      password: "TestPass123",
    },
  });
  const userToken = userReg.data?.data?.token;
  const r403 = await api("GET", "/admin/sync/jobs", { token: userToken });
  if (r403.status === 403) ok("Admin API non-admin → 403");
  else fail("Admin 403", `${r403.status}`);

  // Trigger manual sync (no live credentials → failed job, readable error)
  const trig = await api("POST", "/admin/sync/jobs/trigger", {
    token: adminToken,
    body: { storeSlug: "amazon" },
  });
  const job = trig.data?.data?.job;
  if (trig.status === 201 && job?.status === "failed" && /not configured/.test(job.error || ""))
    ok("T-TRIGGER CRITERION: unconfigured adapter → failed job with readable error");
  else fail("T-TRIGGER", `${trig.status} ${JSON.stringify(job?.error)}`);

  // Jobs list + detail
  const jobsList = await api("GET", "/admin/sync/jobs?status=failed", { token: adminToken });
  if (jobsList.status === 200 && jobsList.data?.data?.jobs?.length >= 1)
    ok("Jobs list returns failed jobs");
  else fail("Jobs list", `${jobsList.status}`);
  const jobDetail = await api("GET", `/admin/sync/jobs/${job._id}`, { token: adminToken });
  if (jobDetail.status === 200 && jobDetail.data?.data?.job?.store?.slug === "amazon")
    ok("Job detail with populated store");
  else fail("Job detail", `${jobDetail.status}`);

  // Adapters status
  const adapters = await api("GET", "/admin/sync/adapters", { token: adminToken });
  const adapterList = adapters.data?.data?.adapters || [];
  if (
    adapters.status === 200 &&
    adapterList.length === 3 &&
    adapterList.every((a) => a.configured === false)
  )
    ok("Adapters endpoint: 3 adapters, configured=false without creds");
  else fail("Adapters", JSON.stringify(adapterList));

  // Data issues list (criterion 7 via API)
  const issues = await api("GET", "/admin/data-issues?status=open", { token: adminToken });
  const issueTypes = (issues.data?.data?.issues || []).map((i) => i.type);
  if (issues.status === 200 && issueTypes.includes("ambiguous_match") && issueTypes.includes("invalid_data"))
    ok("T7 CRITERION: ambiguous + invalid issues visible in admin queue");
  else fail("Issues API", JSON.stringify(issueTypes));

  // Resolve an issue
  const resolve = await api("PATCH", `/admin/data-issues/${ambIssue._id}`, {
    token: adminToken,
    body: { status: "resolved", resolution: "Confirmed distinct product (test)" },
  });
  if (resolve.status === 200 && resolve.data?.data?.issue?.status === "resolved")
    ok("Issue resolve PATCH persists");
  else fail("Resolve", `${resolve.status}`);

  // --- Scheduler: produces scheduled SyncJob records ---
  // Temporarily direct: call triggerSync type scheduled for flipkart (already failed-config; still creates record)
  const scheduledJob = await triggerSync("flipkart", { type: "scheduled" });
  if (scheduledJob.type === "scheduled" && scheduledJob.status === "failed")
    ok("Scheduler-style scheduled job created with accurate lifecycle");
  else fail("Scheduled job", JSON.stringify(scheduledJob));
  const schedCount = await SyncJob.countDocuments({ type: "scheduled" });
  if (schedCount >= 1) ok("SyncJob records persisted for scheduled runs");
  else fail("SyncJob records", `count=${schedCount}`);

  // startScheduler smoke (short run): creates jobs via tick
  startScheduler(60000);
  await new Promise((r) => setTimeout(r, 12000));
  stopScheduler();
  const afterTick = await SyncJob.countDocuments({ type: "scheduled" });
  if (afterTick > schedCount)
    ok("Scheduler interval fires and creates SyncJob records (CRITERION 1)");
  else fail("Scheduler tick", `${schedCount} → ${afterTick}`);

  // Cleanup test data
  await cleanup();
  await SyncJob.deleteMany({ "error": /not configured/ });
  await DataQualityIssue.deleteMany({ description: /ITEST|test/i, type: { $in: ["ambiguous_match", "invalid_data"] } });
  await User.deleteMany({ email: /notadmin_/ });

  console.log(`\n== Result: ${passed} passed, ${failed} failed ==`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});

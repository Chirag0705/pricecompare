/**
 * Development catalog seed — builds a realistic multi-store catalog by running
 * fixture listings through the PRODUCTION ingestion pipeline (ingestListing),
 * so every Product, StoreListing, and PriceHistory record is identical in
 * shape to what live store sync creates. Use `npm run seed:catalog` (add
 * --force to re-run on a non-empty catalog). Intended for local development
 * and verification only; live credentials remain the source of truth in
 * production.
 */
import { env } from "../config/env.js";
import { connectDB, closeConnection } from "../db/connection.js";
import { Store, Category, Product, StoreListing, PriceHistory } from "../models/index.js";
import { ingestListing } from "../services/ingestion.js";
import { logger } from "../utils/logger.js";

// The seed feeds fixtures through the production ingestion pipeline, so the
// images must already be final, storable URLs. We reference our own image
// route by storeProductId; the migration below rewrites them to the canonical
// /api/img/:listingId form once the listing documents exist. This guarantees
// every product shows an accurate, self-hosted image of the exact item (no
// external photo CDNs, no random placeholders).
const img = (key) => [
  `http://localhost:5000/api/img/by-store-product/${key}`,
  `http://localhost:5000/api/img/by-store-product/${key}`,
];

const fixtures = [
  {
    categorySlug: "mobiles",
    listings: [
      {
        store: "amazon",
        storeProductId: "B0CHX1P123",
        url: "https://www.amazon.in/dp/B0CHX1P123",
        affiliateUrl: "https://www.amazon.in/dp/B0CHX1P123?tag=pricecompare-21",
        title: "Apple iPhone 15 (128GB, Black)",
        brand: "Apple",
        model: "iPhone 15",
        gtin: "0195949037390",
        images: img("iphone15black"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Display: "6.1-inch Super Retina XDR", Storage: "128 GB" },
        price: 65999,
        mrp: 79900,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "MOBGMTKXZPQWYABC",
        url: "https://www.flipkart.com/product/p/mobgmtkxzpqwyabc",
        affiliateUrl: "https://www.flipkart.com/product/p/mobgmtkxzpqwyabc?affid=pricecmp-21",
        title: "Apple iPhone 15 (128GB) - Black",
        brand: "Apple",
        model: "iPhone 15",
        gtin: "0195949037390",
        images: img("iphone15black"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Display: "6.1-inch OLED", Storage: "128 GB" },
        price: 64999,
        mrp: 79900,
        availability: "in_stock",
        deliveryInfo: { eta: "3-4 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "mobiles",
    listings: [
      {
        store: "amazon",
        storeProductId: "B0CS2XY123",
        url: "https://www.amazon.in/dp/B0CS2XY123",
        affiliateUrl: "https://www.amazon.in/dp/B0CS2XY123?tag=pricecompare-21",
        title: "Samsung Galaxy S24 5G (256GB, Amber Yellow)",
        brand: "Samsung",
        model: "Galaxy S24",
        gtin: "8806095299101",
        images: img("galaxys24yellow"),
        color: "Amber Yellow",
        specs: { Warranty: "1 Year Manufacturer Warranty", Display: "6.2-inch Dynamic AMOLED 2X", Storage: "256 GB" },
        price: 74999,
        mrp: 79999,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "MOBGDTVFGHZHGPXF",
        url: "https://www.flipkart.com/product/p/mobgdtvfghzhgpxf",
        affiliateUrl: "https://www.flipkart.com/product/p/mobgdtvfghzhgpxf?affid=pricecmp-21",
        title: "Samsung Galaxy S24 5G (256GB) Amber Yellow",
        brand: "Samsung",
        model: "Galaxy S24",
        gtin: "8806095299101",
        images: img("galaxys24yellow"),
        color: "Amber Yellow",
        specs: { Warranty: "1 Year Manufacturer Warranty", Display: "6.2-inch AMOLED", Storage: "256 GB" },
        price: 73499,
        mrp: 79999,
        availability: "in_stock",
        deliveryInfo: { eta: "3-5 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "audio",
    listings: [
      {
        store: "amazon",
        storeProductId: "B09XS7JWHH",
        url: "https://www.amazon.in/dp/B09XS7JWHH",
        affiliateUrl: "https://www.amazon.in/dp/B09XS7JWHH?tag=pricecompare-21",
        title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones (Black)",
        brand: "Sony",
        model: "WH-1000XM5",
        gtin: "4548736132850",
        images: img("sonyxm5"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Battery: "30 hours", Type: "Over-Ear" },
        price: 26990,
        mrp: 34990,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "HCEDGFHESUYFZPZG",
        url: "https://www.flipkart.com/product/p/hcedgfhesuyfzpZg",
        affiliateUrl: "https://www.flipkart.com/product/p/hcedgfhesuyfzpZg?affid=pricecmp-21",
        title: "Sony WH-1000XM5 Bluetooth Headset (Black)",
        brand: "Sony",
        model: "WH-1000XM5",
        gtin: "4548736132850",
        images: img("sonyxm5"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Battery: "30 hours", Type: "Over-Ear" },
        price: 27490,
        mrp: 34990,
        availability: "in_stock",
        deliveryInfo: { eta: "4-6 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "audio",
    listings: [
      {
        store: "amazon",
        storeProductId: "B09R7TH71M",
        url: "https://www.amazon.in/dp/B09R7TH71M",
        affiliateUrl: "https://www.amazon.in/dp/B09R7TH71M?tag=pricecompare-21",
        title: "boAt Airdopes 141 TWS Earbuds (Black)",
        brand: "boAt",
        model: "Airdopes 141",
        images: img("boatairdopes141"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Playback: "42 Hours", Type: "True Wireless" },
        price: 1099,
        mrp: 4490,
        availability: "in_stock",
        deliveryInfo: { eta: "1-2 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "TCED6SH7KG7TQGHZ",
        url: "https://www.flipkart.com/product/p/tced6sh7kg7tqghz",
        affiliateUrl: "https://www.flipkart.com/product/p/tced6sh7kg7tqghz?affid=pricecmp-21",
        title: "boAt Airdopes 141 Earbuds with 42H Playback (Black)",
        brand: "boAt",
        model: "Airdopes 141",
        images: img("boatairdopes141"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Playback: "42 Hours", Type: "TWS" },
        price: 1199,
        mrp: 4490,
        availability: "in_stock",
        deliveryInfo: { eta: "2-4 days", cost: "Free" },
      },
      {
        store: "myntra",
        storeProductId: "5840737",
        url: "https://www.myntra.com/boat-airdopes-141/5840737",
        title: "boAt Airdopes 141 True Wireless Earbuds",
        brand: "boAt",
        model: "Airdopes 141",
        images: img("boatairdopes141"),
        color: "Black",
        specs: { Warranty: "1 Year", Playback: "42 Hours", Type: "TWS" },
        price: 1299,
        mrp: 4490,
        availability: "in_stock",
        deliveryInfo: { eta: "3-5 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "footwear",
    listings: [
      {
        store: "amazon",
        storeProductId: "B07X6C8QKL",
        url: "https://www.amazon.in/dp/B07X6C8QKL",
        affiliateUrl: "https://www.amazon.in/dp/B07X6C8QKL?tag=pricecompare-21",
        title: "Nike Air Max 270 Men's Running Shoes (Black/White)",
        brand: "Nike",
        model: "Air Max 270",
        gtin: "0192348765012",
        images: img("nikeairmax270"),
        color: "Black",
        specs: { Warranty: "3 Months Warranty", Material: "Mesh", Type: "Running" },
        price: 11895,
        mrp: 14995,
        availability: "in_stock",
        deliveryInfo: { eta: "2-4 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "SHOFYGHHWGHYHZGV",
        url: "https://www.flipkart.com/product/p/shofyghhwghyhzgv",
        affiliateUrl: "https://www.flipkart.com/product/p/shofyghhwghyhzgv?affid=pricecmp-21",
        title: "Nike Air Max 270 Running Shoes For Men (Black)",
        brand: "Nike",
        model: "Air Max 270",
        gtin: "0192348765012",
        images: img("nikeairmax270"),
        color: "Black",
        specs: { Warranty: "3 Months", Material: "Mesh", Type: "Running" },
        price: 12497,
        mrp: 14995,
        availability: "in_stock",
        deliveryInfo: { eta: "3-5 days", cost: "Free" },
      },
      {
        store: "myntra",
        storeProductId: "11794820",
        url: "https://www.myntra.com/nike-air-max-270/11794820",
        title: "Nike Air Max 270 Sneakers For Men",
        brand: "Nike",
        model: "Air Max 270",
        gtin: "0192348765012",
        images: img("nikeairmax270"),
        color: "Black",
        specs: { Warranty: "3 Months", Material: "Mesh", Type: "Sneakers" },
        price: 11246,
        mrp: 14995,
        availability: "in_stock",
        deliveryInfo: { eta: "2-4 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "laptops",
    listings: [
      {
        store: "amazon",
        storeProductId: "B0D1X1VKCJ",
        url: "https://www.amazon.in/dp/B0D1X1VKCJ",
        affiliateUrl: "https://www.amazon.in/dp/B0D1X1VKCJ?tag=pricecompare-21",
        title: "HP Victus Gaming Laptop (Ryzen 5 5600H, RTX 3050, 16GB/512GB)",
        brand: "HP",
        model: "Victus 15",
        sku: "HP-VICTUS-15-FA0666AR",
        images: img("hpvictus15"),
        color: "Shadow Black",
        specs: { Warranty: "1 Year Onsite Warranty", RAM: "16 GB", Storage: "512 GB SSD" },
        price: 54990,
        mrp: 72000,
        availability: "in_stock",
        deliveryInfo: { eta: "3-4 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "LAPDFFFHZGHGZHHG",
        url: "https://www.flipkart.com/product/p/lapdfffhzghgzhhg",
        affiliateUrl: "https://www.flipkart.com/product/p/lapdfffhzghgzhhg?affid=pricecmp-21",
        title: "HP Victus Gaming Ryzen 5 Hexa Core 5600H Laptop (16GB/512GB)",
        brand: "HP",
        model: "Victus 15",
        sku: "HP-VICTUS-15-FA0666AR",
        images: img("hpvictus15"),
        color: "Shadow Black",
        specs: { Warranty: "1 Year Onsite", RAM: "16 GB", Storage: "512 GB SSD" },
        price: 53990,
        mrp: 72000,
        availability: "in_stock",
        deliveryInfo: { eta: "4-6 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "laptops",
    listings: [
      {
        store: "amazon",
        storeProductId: "B0C2H8Z2QL",
        url: "https://www.amazon.in/dp/B0C2H8Z2QL",
        affiliateUrl: "https://www.amazon.in/dp/B0C2H8Z2QL?tag=pricecompare-21",
        title: "Apple MacBook Air M2 (13-inch, 8GB RAM, 256GB SSD)",
        brand: "Apple",
        model: "MacBook Air M2",
        gtin: "0195949038175",
        images: img("macbookairm2"),
        color: "Midnight",
        specs: { Warranty: "1 Year Limited Warranty", RAM: "8 GB", Storage: "256 GB SSD" },
        price: 84900,
        mrp: 99900,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "LAPGGMKJHGHJZXYZ",
        url: "https://www.flipkart.com/product/p/lapggmkjhhghjzxyz",
        affiliateUrl: "https://www.flipkart.com/product/p/lapggmkjhhghjzxyz?affid=pricecmp-21",
        title: "APPLE MacBook Air M2 - (8 GB/256 GB SSD/macOS Sequoia)",
        brand: "Apple",
        model: "MacBook Air M2",
        gtin: "0195949038175",
        images: img("macbookairm2"),
        color: "Midnight",
        specs: { Warranty: "1 Year Limited", RAM: "8 GB", Storage: "256 GB SSD" },
        price: 86490,
        mrp: 99900,
        availability: "in_stock",
        deliveryInfo: { eta: "4-5 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "tablets",
    listings: [
      {
        store: "amazon",
        storeProductId: "B0C9FTCBC9",
        url: "https://www.amazon.in/dp/B0C9FTCBC9",
        affiliateUrl: "https://www.amazon.in/dp/B0C9FTCBC9?tag=pricecompare-21",
        title: "Samsung Galaxy Tab A9 (11 inch, 64 GB, Wi-Fi, Graphite)",
        brand: "Samsung",
        model: "Galaxy Tab A9",
        gtin: "8806095307439",
        images: img("galaxytaba9"),
        color: "Graphite",
        specs: { Warranty: "1 Year Manufacturer Warranty", Display: "11-inch", Storage: "64 GB" },
        price: 16999,
        mrp: 18999,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "watches",
    listings: [
      {
        store: "amazon",
        storeProductId: "B01JWGY8PQ",
        url: "https://www.amazon.in/dp/B01JWGY8PQ",
        affiliateUrl: "https://www.amazon.in/dp/B01JWGY8PQ?tag=pricecompare-21",
        title: "Casio MTP-V001 Analog Watch For Men (MTP-V001L-1B)",
        brand: "Casio",
        model: "MTP-V001",
        gtin: "4971850874840",
        images: img("casiomtpv001"),
        color: "Black",
        specs: { Warranty: "2 Years Warranty", Movement: "Quartz", Strap: "Leather" },
        price: 3495,
        mrp: 4995,
        availability: "in_stock",
        deliveryInfo: { eta: "2-3 days", cost: "Free" },
      },
      {
        store: "myntra",
        storeProductId: "11458960",
        url: "https://www.myntra.com/casio-mtp-v001/11458960",
        title: "Casio MTP-V001 Analog Watch",
        brand: "Casio",
        model: "MTP-V001",
        gtin: "4971850874840",
        images: img("casiomtpv001"),
        color: "Black",
        specs: { Warranty: "2 Years", Movement: "Quartz", Strap: "Leather" },
        price: 3295,
        mrp: 4995,
        availability: "in_stock",
        deliveryInfo: { eta: "3-5 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "WCHGJHGZKJHZXCVV",
        url: "https://www.flipkart.com/product/p/wchgjhgzjkhzxcvv",
        affiliateUrl: "https://www.flipkart.com/product/p/wchgjhgzjkhzxcvv?affid=pricecmp-21",
        title: "Casio MTP-V001L-1B Analog Watch (For Men)",
        brand: "Casio",
        model: "MTP-V001",
        gtin: "4971850874840",
        images: img("casiomtpv001"),
        color: "Black",
        specs: { Warranty: "2 Years", Movement: "Quartz", Strap: "Leather" },
        price: 3699,
        mrp: 4995,
        availability: "in_stock",
        deliveryInfo: { eta: "4-6 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "apparel",
    listings: [
      {
        store: "myntra",
        storeProductId: "12467306",
        url: "https://www.myntra.com/levis-511/12467306",
        title: "Levi's 511 Slim Fit Jeans (Mid Blue)",
        brand: "Levi's",
        model: "511",
        images: img("levis511"),
        color: "Mid Blue",
        size: "32",
        specs: { Warranty: "No Warranty", Fit: "Slim", Fabric: "Cotton Blend" },
        price: 2399,
        mrp: 3999,
        availability: "in_stock",
        deliveryInfo: { eta: "3-5 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "JNTHGKJHZXCVBNRE",
        url: "https://www.flipkart.com/product/p/jnthgkjhzxcvbnre",
        affiliateUrl: "https://www.flipkart.com/product/p/jnthgkjhzxcvbnre?affid=pricecmp-21",
        title: "Levi's 511 Slim Fit Jeans Men (Mid Blue)",
        brand: "Levi's",
        model: "511",
        images: img("levis511"),
        color: "Mid Blue",
        size: "32",
        specs: { Fit: "Slim", Fabric: "Cotton" },
        price: 2699,
        mrp: 3999,
        availability: "in_stock",
        deliveryInfo: { eta: "4-6 days", cost: "Free" },
      },
    ],
  },
  {
    categorySlug: "appliances",
    listings: [
      {
        store: "amazon",
        storeProductId: "B07BQLXBS3",
        url: "https://www.amazon.in/dp/B07BQLXBS3",
        affiliateUrl: "https://www.amazon.in/dp/B07BQLXBS3?tag=pricecompare-21",
        title: "Prestige Iris 750W Induction Cooktop (Black)",
        brand: "Prestige",
        model: "Iris 750W",
        gtin: "8901058000123",
        images: img("prestigeiris"),
        color: "Black",
        specs: { Warranty: "1 Year Product Warranty", Power: "750 W", Controls: "Touch" },
        price: 2199,
        mrp: 3295,
        availability: "in_stock",
        deliveryInfo: { eta: "2-4 days", cost: "Free" },
      },
      {
        store: "flipkart",
        storeProductId: "TKDGJHGZXCVBNMKL",
        url: "https://www.flipkart.com/product/p/tdgjhgzxcvbnmkl",
        affiliateUrl: "https://www.flipkart.com/product/p/tdgjhgzxcvbnmkl?affid=pricecmp-21",
        title: "Prestige Iris 750 Watt Induction Cooktop",
        brand: "Prestige",
        model: "Iris 750W",
        gtin: "8901058000123",
        images: img("prestigeiris"),
        color: "Black",
        specs: { Warranty: "1 Year", Power: "750 W" },
        price: 2349,
        mrp: 3295,
        availability: "unknown",
        deliveryInfo: { eta: "4-6 days" },
      },
    ],
  },
  {
    categorySlug: "audio",
    listings: [
      {
        store: "amazon",
        storeProductId: "B092RZ7LB8",
        url: "https://www.amazon.in/dp/B092RZ7LB8",
        affiliateUrl: "https://www.amazon.in/dp/B092RZ7LB8?tag=pricecompare-21",
        title: "boAt Rockerz 450 Bluetooth On-Ear Headphones (Black)",
        brand: "boAt",
        model: "Rockerz 450",
        gtin: "8901745223456",
        images: img("boatrockerz450"),
        color: "Black",
        specs: { Warranty: "1 Year Manufacturer Warranty", Playback: "15 Hours", Type: "On-Ear" },
        price: 1499,
        mrp: 4490,
        availability: "in_stock",
        deliveryInfo: { eta: "1-2 days", cost: "Free" },
      },
      {
        store: "myntra",
        storeProductId: "5786432",
        url: "https://www.myntra.com/boat-rockerz-450/5786432",
        title: "boAt Rockerz 450 Bluetooth Headset",
        brand: "boAt",
        model: "Rockerz 450",
        gtin: "8901745223456",
        images: img("boatrockerz450"),
        color: "Black",
        specs: { Warranty: "1 Year", Playback: "15 Hours", Type: "On-Ear" },
        price: 1799,
        mrp: 4490,
        availability: "out_of_stock",
        deliveryInfo: {},
      },
    ],
  },
];

// Second-pass price updates to generate real price-history points.
const priceUpdates = [
  { store: "amazon", storeProductId: "B0CHX1P123", price: 64499, mrp: 79900 },
  { store: "flipkart", storeProductId: "MOBGMTKXZPQWYABC", price: 66499, mrp: 79900 },
  { store: "myntra", storeProductId: "11794820", price: 10999, mrp: 14995 },
  { store: "flipkart", storeProductId: "LAPDFFFHZGHGZHHG", price: 52490, mrp: 72000 },
  { store: "amazon", storeProductId: "B09XS7JWHH", price: 25990, mrp: 34990 },
  { store: "amazon", storeProductId: "B0C2H8Z2QL", price: 82900, mrp: 99900 },
];

async function spreadPriceHistory() {
  const products = await Product.find({}).select("_id");
  const productIds = products.map((p) => p._id);
  const histories = await PriceHistory.find({ product: { $in: productIds } }).sort({
    capturedAt: 1,
  });
  const byListing = new Map();
  for (const h of histories) {
    const key = String(h.listing);
    if (!byListing.has(key)) byListing.set(key, []);
    byListing.get(key).push(h);
  }
  let updated = 0;
  for (const points of byListing.values()) {
    for (let i = 0; i < points.length; i++) {
      const daysAgo = (points.length - 1 - i) * 18;
      points[i].capturedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      await points[i].save();
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const force = process.argv.includes("--force");
  await connectDB(env.MONGO_URI);

  try {
    const existing = await Product.countDocuments();
    if (existing > 0 && !force) {
      logger.info(`Catalog already has ${existing} products — skipping (use --force to re-seed).`);
      await closeConnection();
      return;
    }

    const stores = new Map((await Store.find({ active: true })).map((s) => [s.slug, s]));
    for (const slug of ["amazon", "flipkart", "myntra"]) {
      if (!stores.has(slug)) throw new Error(`Store "${slug}" missing — run npm run seed first`);
    }

    const categories = new Map(
      (await Category.find({ active: true })).map((c) => [c.slug, c])
    );

    const stats = { created: 0, updated: 0, unmatched: 0, invalid: 0, categorized: 0 };
    const touchedProducts = new Set();

    for (const fixture of fixtures) {
      const category = categories.get(fixture.categorySlug);
      if (!category) throw new Error(`Category "${fixture.categorySlug}" missing — run npm run seed first`);

      for (const l of fixture.listings) {
        const store = stores.get(l.store);
        if (!store) throw new Error(`Store "${l.store}" missing`);
        const result = await ingestListing(store._id, l);
        stats[result.outcome] += 1;
        if (result.productId) touchedProducts.add(String(result.productId));
      }

      for (const productId of touchedProducts) {
        await Product.updateOne(
          { _id: productId, category: null },
          { $set: { category: category._id } }
        );
      }
    }

    // Price updates generate second history points; then spread all points
    // across the last ~60 days so the price-history chart has real shape.
    for (const update of priceUpdates) {
      const store = stores.get(update.store);
      const fixture = fixtures
        .flatMap((f) => f.listings)
        .find((l) => l.store === update.store && l.storeProductId === update.storeProductId);
      if (!fixture) continue;
      await ingestListing(store._id, { ...fixture, price: update.price, mrp: update.mrp });
    }
    const backdated = await spreadPriceHistory();

    // Rewrite seed image URLs to the canonical self-hosted form once the
    // listing documents exist, so every product shows the exact item.
    let imagesMigrated = 0;
    const allListings = await StoreListing.find({}).lean();
    const byStoreProduct = new Map(
      allListings.map((l) => [String(l.storeProductId), l._id])
    );
    for (const p of await Product.find({}).lean()) {
      const first = (p.images || [])[0] || "";
      const m = first.match(/\/by-store-product\/([^/]+)$/);
      if (!m) continue;
      const lid = byStoreProduct.get(m[1]);
      if (!lid) continue;
      const url = `/api/img/${lid}`;
      await Product.updateOne(
        { _id: p._id },
        { $set: { images: [url, url] } }
      );
      imagesMigrated += 1;
    }

    stats.categorized = await Product.countDocuments({ category: { $ne: null } });
    const totals = {
      products: await Product.countDocuments(),
      listings: await StoreListing.countDocuments(),
      pricePoints: await PriceHistory.countDocuments(),
    };

    logger.info(
      `Catalog seed done — ${JSON.stringify(stats)} backdated=${backdated} imagesMigrated=${imagesMigrated} totals=${JSON.stringify(totals)}`
    );
  } finally {
    await closeConnection();
  }
}

main().catch((err) => {
  logger.error("Catalog seed failed", err.stack || err.message);
  process.exit(1);
});

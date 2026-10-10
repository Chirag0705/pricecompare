import mongoose from "mongoose";
import {
  User,
  Store,
  Category,
  Product,
  StoreListing,
  PriceHistory,
  Wishlist,
  PriceAlert,
  SyncJob,
  DataQualityIssue,
  Notification,
  ActivityLog,
} from "../src/models/index.js";

await mongoose.connect("mongodb://127.0.0.1:27017/pricecompare");

const models = {
  User,
  Store,
  Category,
  Product,
  StoreListing,
  PriceHistory,
  Wishlist,
  PriceAlert,
  SyncJob,
  DataQualityIssue,
  Notification,
  ActivityLog,
};

for (const [name, model] of Object.entries(models)) {
  const indexes = await model.collection.getIndexes();
  console.log(`${name}: ${Object.keys(indexes).join(", ")}`);
}

const textIdx = await Product.collection.getIndexes();
const hasText = Object.keys(textIdx).includes("ProductTextIndex");
console.log("Product has text index (ProductTextIndex):", hasText);

const slIdx = await StoreListing.collection.getIndexes();
console.log(
  "StoreListing unique store+storeProductId:",
  JSON.stringify(slIdx.store_1_storeProductId_1)
);

const wIdx = await Wishlist.collection.getIndexes();
console.log("Wishlist unique user+product:", JSON.stringify(wIdx.user_1_product_1));

const admin = await User.findOne({
  email: "admin@pricecompare.local",
}).select("+passwordHash");
const bcryptMod = await import("bcryptjs");
const bcrypt = bcryptMod.default ?? bcryptMod;
const verifies = admin
  ? await bcrypt.compare("AdminPass123!", admin.passwordHash)
  : false;
console.log("Admin role:", admin?.role);
console.log("Admin passwordHash verifies against seed password:", verifies);
console.log(
  "Admin passwordHash is bcrypt:",
  admin?.passwordHash?.startsWith("$2") ?? false
);

// Unique constraint tests
try {
  await User.create({
    name: "Dup",
    email: "admin@pricecompare.local",
    passwordHash: "x".repeat(60),
  });
  console.log("UNIQUE email constraint: FAILED (duplicate allowed)");
} catch (e) {
  console.log(
    "UNIQUE email constraint: PASS",
    e.code === 11000 ? "(E11000)" : e.message
  );
}

try {
  await Store.create({
    name: "DupStore",
    slug: "amazon",
    domain: "dup.com",
  });
  console.log("UNIQUE store slug constraint: FAILED");
} catch (e) {
  console.log(
    "UNIQUE store slug constraint: PASS",
    e.code === 11000 ? "(E11000)" : e.message
  );
}

console.log("VERIFICATION COMPLETE");
await mongoose.disconnect();

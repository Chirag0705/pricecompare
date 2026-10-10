import mongoose from "mongoose";
import {
  Product,
  StoreListing,
  PriceHistory,
  Wishlist,
  PriceAlert,
  Notification,
  Store,
  Category,
} from "../src/models/index.js";

await mongoose.connect("mongodb://127.0.0.1:27017/pricecompare");
const stale = await Product.find({
  $or: [
    { brand: { $in: ["P6Brand", "P6BrandUpdated", "P6MergeBrand", "P6MutBrand", "P6StoreBrand"] } },
    { title: /^P6 / },
    { title: /^P6MANUAL/ },
  ],
}).select("_id");
const ids = stale.map((p) => p._id);
await StoreListing.deleteMany({ product: { $in: ids } });
await PriceHistory.deleteMany({ product: { $in: ids } });
await Wishlist.deleteMany({ product: { $in: ids } });
await PriceAlert.deleteMany({ product: { $in: ids } });
await Notification.deleteMany({ product: { $in: ids } });
await Product.deleteMany({ _id: { $in: ids } });
await Store.deleteMany({ slug: /^p6-test-store-/ });
await Category.deleteMany({ slug: /^p6-/ });
console.log("cleaned", ids.length, "stale products");
await mongoose.disconnect();

import mongoose from "mongoose";
import { Product, StoreListing, PriceHistory } from "../src/models/index.js";

await mongoose.connect("mongodb://127.0.0.1:27017/pricecompare");
const stale = await Product.find({ title: /^Live Merge/ }).select("_id");
const ids = stale.map((p) => p._id);
if (ids.length) {
  await StoreListing.deleteMany({ product: { $in: ids } });
  await PriceHistory.deleteMany({ product: { $in: ids } });
  await Product.deleteMany({ _id: { $in: ids } });
}
console.log("removed", ids.length, "live-merge products");
await mongoose.disconnect();

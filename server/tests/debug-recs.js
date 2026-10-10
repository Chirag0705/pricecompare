import mongoose from "mongoose";
import { Product, Store, ActivityLog } from "../src/models/index.js";
import { escapeRegex } from "../src/services/matching.js";

await mongoose.connect("mongodb://127.0.0.1:27017/pricecompare");

const product = await Product.findOne({ archived: { $ne: true } }).select("category brand").lean();
console.log("product:", product);

const activeStoreIds = (await Store.find({ active: true }).select("_id")).map((s) => s._id);
console.log("activeStoreIds:", activeStoreIds.length);

const relatedConditions = [{ archived: { $ne: true }, _id: { $ne: product._id } }];
if (product.category) relatedConditions.push({ archived: { $ne: true }, _id: { $ne: product._id }, category: product.category });
if (product.brand) relatedConditions.push({ archived: { $ne: true }, _id: { $ne: product._id }, brand: new RegExp(`^${escapeRegex(product.brand)}$`, "i") });

const relatedDocs = await Product.find({ $or: relatedConditions }).select("title brand images category createdAt").sort({ createdAt: -1 }).limit(12).lean();
console.log("relatedDocs:", relatedDocs.length);

const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const trendingAgg = await ActivityLog.aggregate([
  { $match: { action: "click.buy_now", createdAt: { $gte: since } } },
  { $group: { _id: "$metadata.productId", clicks: { $sum: 1 } } },
  { $sort: { clicks: -1 } },
  { $limit: 12 },
]);
console.log("trendingAgg:", trendingAgg.length, trendingAgg.slice(0, 3));

await mongoose.disconnect();

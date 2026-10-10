import mongoose from "mongoose";
import { Product, StoreListing, Category, Store } from "../src/models/index.js";

await mongoose.connect("mongodb://127.0.0.1:27017/pricecompare");
const products = await Product.find({
  $or: [
    { brand: /P6/ },
    { title: /P6/ },
    { normalizedTitle: /p6/ },
  ],
}).select("title brand archived");
console.log("P6 products:", JSON.stringify(products, null, 2));
const cats = await Category.find({ slug: /^p6-/ }).select("slug");
console.log("P6 categories:", cats.length);
const stores = await Store.find({ slug: /^p6-/ }).select("slug");
console.log("P6 stores:", stores.length);
await mongoose.disconnect();

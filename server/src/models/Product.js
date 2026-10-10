import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    brand: { type: String, trim: true, index: true },
    model: { type: String, trim: true },
    sku: { type: String, trim: true },
    identifiers: {
      gtin: { type: String, trim: true },
      ean: { type: String, trim: true },
      upc: { type: String, trim: true },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    images: [{ type: String }],
    specs: { type: Map, of: String, default: {} },
    variant: {
      color: { type: String, trim: true },
      size: { type: String, trim: true },
      name: { type: String, trim: true },
    },
    normalizedTitle: { type: String, trim: true, index: true },
    searchTags: [{ type: String }],
    archived: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.index(
  { title: "text", brand: "text", model: "text" },
  { weights: { title: 10, brand: 5, model: 3 }, name: "ProductTextIndex" }
);
productSchema.index({ brand: 1, normalizedTitle: 1 });

export const Product = mongoose.model("Product", productSchema);

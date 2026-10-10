import mongoose from "mongoose";

const priceHistorySchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreListing",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    mrp: { type: Number, min: 0 },
    capturedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

priceHistorySchema.index({ product: 1, capturedAt: -1 });
priceHistorySchema.index({ listing: 1, capturedAt: -1 });
priceHistorySchema.index({ capturedAt: -1 });

export const PriceHistory = mongoose.model("PriceHistory", priceHistorySchema);

import mongoose from "mongoose";

const storeListingSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    storeProductId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    affiliateUrl: { type: String, trim: true },
    currentPrice: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"],
    },
    discountPercent: { type: Number, min: 0, max: 100 },
    availability: {
      type: String,
      enum: ["in_stock", "out_of_stock", "unknown"],
      default: "unknown",
    },
    deliveryInfo: { type: mongoose.Schema.Types.Mixed },
    lastSyncedAt: { type: Date, default: Date.now },
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

storeListingSchema.index(
  { store: 1, storeProductId: 1 },
  { unique: true }
);
storeListingSchema.index({ product: 1, currentPrice: 1 });

storeListingSchema.pre("findOneAndDelete", async function (next) {
  try {
    const listing = await this.model.findOne(this.getFilter());
    if (!listing) return next();
    const priceHistoryCount = await mongoose
      .model("PriceHistory")
      .countDocuments({ listing: listing._id });
    if (priceHistoryCount > 0) {
      const err = new Error(
        "Cannot delete listing with price history. Archive it instead."
      );
      err.statusCode = 409;
      return next(err);
    }
    next();
  } catch (err) {
    next(err);
  }
});

export const StoreListing = mongoose.model("StoreListing", storeListingSchema);

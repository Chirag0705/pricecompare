import mongoose from "mongoose";

const priceAlertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    targetPrice: {
      type: Number,
      required: true,
      min: [0, "Target price cannot be negative"],
    },
    condition: {
      type: String,
      enum: ["below_target"],
      default: "below_target",
    },
    active: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
    // Dedup: a notification is only created when the best price reaches the
    // target at a price point different from the last one that triggered.
    lastTriggeredPrice: { type: Number },
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

priceAlertSchema.index({ user: 1, active: 1 });
priceAlertSchema.index({ product: 1, active: 1 });

export const PriceAlert = mongoose.model("PriceAlert", priceAlertSchema);

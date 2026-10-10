import mongoose from "mongoose";

const dataQualityIssueSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["unmatched_listing", "ambiguous_match", "invalid_data"],
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreListing",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    suggested: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      default: "open",
      index: true,
    },
    resolution: { type: String },
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

dataQualityIssueSchema.index({ status: 1, createdAt: -1 });

export const DataQualityIssue = mongoose.model(
  "DataQualityIssue",
  dataQualityIssueSchema
);

import mongoose from "mongoose";

const syncJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["scheduled", "manual"],
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "success", "failed"],
      default: "pending",
      index: true,
    },
    stats: {
      fetched: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      unmatched: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    error: { type: String },
    cursor: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
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

syncJobSchema.index({ store: 1, status: 1 });
syncJobSchema.index({ status: 1, startedAt: -1 });

export const SyncJob = mongoose.model("SyncJob", syncJobSchema);

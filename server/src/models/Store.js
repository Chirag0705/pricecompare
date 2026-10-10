import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    domain: { type: String, required: true, trim: true },
    affiliateConfig: {
      paramStyle: {
        type: String,
        enum: ["query", "path", "none"],
        default: "query",
      },
      template: { type: String, default: "" },
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
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

export const Store = mongoose.model("Store", storeSchema);

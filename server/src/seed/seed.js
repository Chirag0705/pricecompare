import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { connectDB, closeConnection } from "../db/connection.js";
import { Store, Category, User } from "../models/index.js";
import { stores } from "./data/stores.js";
import { categoryTree } from "./data/categories.js";
import { logger } from "../utils/logger.js";

async function seedStores() {
  const before = await Store.countDocuments();
  for (const store of stores) {
    await Store.findOneAndUpdate(
      { slug: store.slug },
      { $setOnInsert: store },
      { new: true, upsert: true, runValidators: true }
    );
  }
  const after = await Store.countDocuments();
  return { created: after - before, total: after };
}

async function seedCategories() {
  const before = await Category.countDocuments();
  for (const root of categoryTree) {
    const rootDoc = await Category.findOneAndUpdate(
      { slug: root.slug },
      {
        $setOnInsert: {
          name: root.name,
          slug: root.slug,
          parent: null,
          active: true,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );
    for (const child of root.children) {
      await Category.findOneAndUpdate(
        { slug: child.slug },
        {
          $setOnInsert: {
            name: child.name,
            slug: child.slug,
            parent: rootDoc._id,
            active: true,
          },
        },
        { new: true, upsert: true, runValidators: true }
      );
    }
  }
  const after = await Category.countDocuments();
  return { created: after - before, total: after };
}

async function seedAdmin() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email }).select("+passwordHash");
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
      existing.active = true;
      await existing.save();
      return { action: "promoted", email };
    }
    return { action: "exists", email };
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    name: "Administrator",
    email,
    passwordHash,
    role: "admin",
    active: true,
  });
  return { action: "created", email };
}

async function main() {
  logger.info("Seeding database...");
  await connectDB(env.MONGO_URI);

  const storeResult = await seedStores();
  logger.info(
    `Stores: ${storeResult.created} created, ${storeResult.total} total`
  );

  const catResult = await seedCategories();
  logger.info(
    `Categories: ${catResult.created} created, ${catResult.total} total`
  );

  const adminResult = await seedAdmin();
  logger.info(`Admin (${adminResult.email}): ${adminResult.action}`);

  await closeConnection();
  logger.info("Seed complete");
}

main().catch((err) => {
  logger.error("Seed failed", err.stack || err.message);
  process.exit(1);
});

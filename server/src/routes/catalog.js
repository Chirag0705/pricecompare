import { Router } from "express";
import mongoose from "mongoose";
import {
  Product,
  Category,
  Store,
  StoreListing,
  PriceHistory,
  ActivityLog,
  Wishlist,
} from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { validate } from "../middleware/validate.js";
import { optionalAuth } from "../middleware/auth.js";
import { escapeRegex, normalizeTitle } from "../services/matching.js";
import { apiCache } from "../middleware/apiCache.js";
import {
  searchQuerySchema,
  priceHistoryQuerySchema,
  idParamSchema,
  listingIdParamSchema,
  suggestionQuerySchema,
} from "../schemas/catalogSchemas.js";

const router = Router();

/* ---------- GET /api/stores (public) ---------- */
router.get("/stores", apiCache(10 * 60 * 1000, "stores"), async (_req, res, next) => {
  try {
    const stores = await Store.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("name slug domain");
    res.json({ success: true, data: { stores } });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/categories (tree) ---------- */
router.get("/categories", apiCache(10 * 60 * 1000, "categories"), async (_req, res, next) => {
  try {
    const cats = await Category.find({ active: true })
      .sort({ sortOrder: 1, name: 1 })
      .select("name slug parent");
    const byId = new Map(cats.map((c) => [String(c._id), { ...c.toObject(), children: [] }]));
    const roots = [];
    for (const c of byId.values()) {
      if (c.parent && byId.has(String(c.parent))) {
        byId.get(String(c.parent)).children.push(c);
      } else {
        roots.push(c);
      }
    }
    res.json({ success: true, data: { categories: roots } });
  } catch (err) {
    next(err);
  }
});

async function categoryWithDescendants(slug) {
  const root = await Category.findOne({ slug, active: true }).select("_id name slug");
  if (!root) return null;
  const ids = [root._id];
  let frontier = [root._id];
  while (frontier.length) {
    const children = await Category.find({ parent: { $in: frontier }, active: true }).select("_id");
    frontier = children.map((c) => c._id);
    ids.push(...frontier);
  }
  return { root, ids };
}

/**
 * Best in-stock-preferred price per product (one aggregate, no N+1).
 * Returns Map<productIdString, { bestPrice, hasStock, listingCount }>.
 */
async function bestPricesForProducts(productIds, activeStoreIds) {
  if (!productIds.length) return new Map();
  const objectIds = productIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await StoreListing.aggregate([
    {
      $match: {
        product: { $in: objectIds },
        store: { $in: activeStoreIds },
        archived: { $ne: true },
      },
    },
    { $addFields: { inStockRank: { $cond: [{ $eq: ["$availability", "in_stock"] }, 1, 0] } } },
    { $sort: { inStockRank: -1, currentPrice: 1 } },
    {
      $group: {
        _id: "$product",
        bestPrice: { $first: "$currentPrice" },
        hasStock: { $first: "$inStockRank" },
        listingCount: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

/* ---------- GET /api/products/search ---------- */
router.get(
  "/products/search",
  validate(searchQuerySchema, "query"),
  apiCache(60 * 1000, "search"),
  async (req, res, next) => {
  try {
    const {
      q,
      category,
      brand,
      minPrice,
      maxPrice,
      store,
      availability,
      sort,
      page,
      limit,
    } = req.query;

    const productMatch = { archived: { $ne: true } };
    if (q) productMatch.$text = { $search: q };
    if (category) {
      const cat = await categoryWithDescendants(category);
      if (!cat) throw ApiError.notFound(`Category not found: ${category}`);
      productMatch.category = { $in: cat.ids };
    }

    let storeId = null;
    if (store) {
      const storeDoc = await Store.findOne({ slug: store, active: true }).select("_id");
      if (!storeDoc) throw ApiError.notFound(`Store not found: ${store}`);
      storeId = storeDoc._id;
    }

    // Public comparison only includes listings from enabled stores.
    const activeStoreIds = await Store.find({ active: true }).select("_id");
    const listingMatch = {
      store: { $in: activeStoreIds.map((s) => s._id) },
      archived: { $ne: true },
    };
    if (storeId) listingMatch.store = storeId;

    const listingLookup = {
      from: StoreListing.collection.name,
      localField: "_id",
      foreignField: "product",
      as: "listings",
      pipeline: [{ $match: listingMatch }],
    };

    // "score" is materialized pre-facet so the items sub-pipeline can sort on
    // the plain field. Brand filtering happens INSIDE items/total sub-pipelines
    // so the brands facet still lists alternatives under the other filters.
    const brandMatch = brand
      ? { $match: { brand: { $regex: `^${escapeRegex(brand)}$`, $options: "i" } } }
      : null;

    const sortStage =
      sort === "price_asc"
        ? { bestPrice: 1, createdAt: -1 }
        : sort === "price_desc"
          ? { bestPrice: -1, createdAt: -1 }
          : sort === "discount"
            ? { maxDiscount: -1, bestPrice: 1 }
            : sort === "newest" || !q
              ? { createdAt: -1 }
              : { score: -1 };

    const pipeline = [
      { $match: productMatch },
      ...(q ? [{ $addFields: { score: { $meta: "textScore" } } }] : []),
      { $lookup: listingLookup },
      {
        $addFields: {
          inStockListings: {
            $filter: {
              input: "$listings",
              cond: { $eq: ["$$this.availability", "in_stock"] },
            },
          },
        },
      },
      {
        $addFields: {
          bestPrice: {
            $ifNull: [
              { $min: "$inStockListings.currentPrice" },
              { $min: "$listings.currentPrice" },
            ],
          },
          maxDiscount: { $max: "$listings.discountPercent" },
          listingCount: { $size: "$listings" },
          storeCount: { $size: { $setUnion: ["$listings.store", []] } },
          hasStock: { $gt: [{ $size: "$inStockListings" }, 0] },
          maxMrp: { $max: "$listings.mrp" },
        },
      },
      ...(minPrice !== undefined || maxPrice !== undefined
        ? [
            {
              $match: {
                bestPrice: {
                  ...(minPrice !== undefined ? { $gte: minPrice } : {}),
                  ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
                },
              },
            },
          ]
        : []),
      ...(availability === "in_stock" ? [{ $match: { hasStock: true } }] : []),
      {
        $facet: {
          items: [
            ...(brandMatch ? [brandMatch] : []),
            { $sort: sortStage },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                title: 1,
                brand: 1,
                images: { $slice: ["$images", 1] },
                bestPrice: 1,
                maxMrp: 1,
                maxDiscount: 1,
                listingCount: 1,
                storeCount: 1,
                hasStock: 1,
                category: 1,
                createdAt: 1,
                score: 1,
              },
            },
          ],
          total: [
            ...(brandMatch ? [brandMatch] : []),
            { $count: "count" },
          ],
          brands: [
            { $group: { _id: "$brand", count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, brand: "$_id", count: 1 } },
          ],
        },
      },
    ];

    const [result] = await Product.aggregate(pipeline);
    const total = result.total[0]?.count ?? 0;
    const items = result.items.map((item) => ({
      id: item._id,
      title: item.title,
      brand: item.brand,
      image: item.images[0] || null,
      bestPrice: item.bestPrice,
      maxMrp: item.maxMrp ?? null,
      maxDiscount: item.maxDiscount ?? null,
      listingCount: item.listingCount,
      storeCount: item.storeCount,
      hasStock: item.hasStock,
      category: item.category,
      createdAt: item.createdAt,
    }));

    let categoryEcho = null;
    if (category) {
      const cat = await Category.findOne({ slug: category, active: true })
        .select("name slug");
      categoryEcho = cat ? { id: cat._id, name: cat.name, slug: cat.slug } : null;
    }

    res.json({
      success: true,
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        availableBrands: result.brands,
        category: categoryEcho,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- GET /api/products/suggestions (autocomplete) ---------- */
// Must be registered before /products/:id so "suggestions" isn't parsed as an id.
router.get(
  "/products/suggestions",
  validate(suggestionQuerySchema, "query"),
  apiCache(60 * 1000, "suggestions"),
  async (req, res, next) => {
    try {
      const { q, limit } = req.query;
      const normalized = normalizeTitle(q);
      if (!normalized) {
        return res.json({ success: true, data: { suggestions: [] } });
      }

      const escaped = escapeRegex(normalized);
      const escapedRaw = escapeRegex(q.trim());
      const tokenPattern = normalized
        .split(" ")
        .filter(Boolean)
        .map((t) => escapeRegex(t))
        .join("|");

      // Prefix match on normalized title (index-friendly), brand prefix,
      // then token-contains fallback for mid-string hits.
      const candidates = await Product.find({
        archived: { $ne: true },
        $or: [
          { normalizedTitle: { $regex: `^${escaped}` } },
          { brand: { $regex: `^${escapedRaw}`, $options: "i" } },
          { normalizedTitle: { $regex: tokenPattern } },
        ],
      })
        .select("title brand normalizedTitle images")
        .limit(30)
        .lean();

      if (!candidates.length) {
        return res.json({ success: true, data: { suggestions: [] } });
      }

      const activeStoreIds = (await Store.find({ active: true }).select("_id")).map(
        (s) => s._id
      );
      const priceMap = await bestPricesForProducts(
        candidates.map((c) => c._id),
        activeStoreIds
      );

      // Rank: title-prefix hits first, then brand-prefix, then token hits.
      const ranked = candidates
        .map((c) => {
          const nt = c.normalizedTitle || "";
          let rank = 3;
          if (nt.startsWith(normalized)) rank = 0;
          else if ((c.brand || "").toLowerCase().startsWith(q.trim().toLowerCase())) rank = 1;
          return { ...c, rank };
        })
        .sort((a, b) => a.rank - b.rank)
        .slice(0, limit);

      res.json({
        success: true,
        data: {
          suggestions: ranked.map((c) => {
            const price = priceMap.get(String(c._id));
            return {
              id: c._id,
              title: c.title,
              brand: c.brand,
              image: c.images?.[0] || null,
              bestPrice: price?.bestPrice ?? null,
              hasStock: Boolean(price?.hasStock),
            };
          }),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/products/:id ---------- */
router.get(
  "/products/:id",
  optionalAuth,
  validate(idParamSchema, "params"),
  async (req, res, next) => {
    try {
      const [product, activeStoreIds] = await Promise.all([
        Product.findOne({ _id: req.params.id, archived: { $ne: true } }).populate(
          "category",
          "name slug"
        ),
        Store.find({ active: true }).select("_id"),
      ]);
      if (!product) throw ApiError.notFound("Product not found");

      const [listings, wishDoc] = await Promise.all([
        StoreListing.find({
          product: product._id,
          store: { $in: activeStoreIds.map((s) => s._id) },
          archived: { $ne: true },
        })
          .populate("store", "name slug domain")
          .sort({ currentPrice: 1 })
          .lean(),
        req.user
          ? Wishlist.findOne({ user: req.user._id, product: product._id }).select("_id")
          : null,
      ]);

      const inStock = listings.filter((l) => l.availability === "in_stock");
      const priced = inStock.length ? inStock : listings;
      const bestListing = priced.length
        ? priced.reduce((min, l) => (l.currentPrice < min.currentPrice ? l : min))
        : null;
      const maxMrp = listings.length
        ? Math.max(...listings.map((l) => l.mrp || 0))
        : null;

      res.json({
        success: true,
        data: {
          product: {
            id: product._id,
            title: product.title,
            brand: product.brand,
            model: product.model,
            sku: product.sku,
            identifiers: product.identifiers,
            images: product.images,
            specs: product.specs instanceof Map ? Object.fromEntries(product.specs) : product.specs,
            variant: product.variant,
            category: product.category,
            createdAt: product.createdAt,
          },
          listings: listings.map((l) => ({
            id: l._id,
            store: l.store,
            url: l.url,
            currentPrice: l.currentPrice,
            mrp: l.mrp ?? null,
            discountPercent: l.discountPercent ?? null,
            availability: l.availability,
            deliveryInfo: l.deliveryInfo ?? null,
            lastSyncedAt: l.lastSyncedAt,
          })),
          summary: {
            bestPrice: bestListing?.currentPrice ?? null,
            bestListingId: bestListing?._id ?? null,
            bestStore: bestListing?.store ?? null,
            maxMrp,
            savings:
              bestListing && maxMrp && maxMrp > bestListing.currentPrice
                ? maxMrp - bestListing.currentPrice
                : null,
            storeCount: new Set(listings.map((l) => String(l.store?._id ?? l.store))).size,
            hasStock: inStock.length > 0,
          },
          wishlisted: Boolean(wishDoc),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/products/:id/price-history ---------- */
router.get(
  "/products/:id/price-history",
  validate(idParamSchema, "params"),
  validate(priceHistoryQuerySchema, "query"),
  apiCache(5 * 60 * 1000, "price-history"),
  async (req, res, next) => {
    try {
      const product = await Product.findOne({
        _id: req.params.id,
        archived: { $ne: true },
      }).select("_id");
      if (!product) throw ApiError.notFound("Product not found");

      const since = new Date(Date.now() - req.query.days * 24 * 60 * 60 * 1000);

      const points = await PriceHistory.aggregate([
        { $match: { product: product._id, capturedAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$capturedAt" },
            },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
            avgPrice: { $avg: "$price" },
            maxMrp: { $max: "$mrp" },
            samples: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: "$_id",
            minPrice: { $round: ["$minPrice", 2] },
            maxPrice: { $round: ["$maxPrice", 2] },
            avgPrice: { $round: ["$avgPrice", 2] },
            maxMrp: { $ifNull: [{ $round: ["$maxMrp", 2] }, null] },
            samples: 1,
          },
        },
      ]);

      res.json({ success: true, data: { points, days: req.query.days } });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/products/:id/recommendations ---------- */
router.get(
  "/products/:id/recommendations",
  validate(idParamSchema, "params"),
  apiCache(5 * 60 * 1000, "recommendations"),
  async (req, res, next) => {
    try {
      const product = await Product.findOne({
        _id: req.params.id,
        archived: { $ne: true },
      })
        .select("category brand")
        .lean();
      if (!product) throw ApiError.notFound("Product not found");

      const activeStoreIds = (await Store.find({ active: true }).select("_id")).map(
        (s) => s._id
      );

      // --- Related: same category OR same brand, excluding self ---
      const relatedConditions = [{ archived: { $ne: true }, _id: { $ne: product._id } }];
      if (product.category) {
        relatedConditions.push({ archived: { $ne: true }, _id: { $ne: product._id }, category: product.category });
      }
      if (product.brand) {
        relatedConditions.push({
          archived: { $ne: true },
          _id: { $ne: product._id },
          brand: new RegExp(`^${escapeRegex(product.brand)}$`, "i"),
        });
      }
      const relatedDocs = await Product.find({ $or: relatedConditions })
        .select("title brand images category createdAt")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();

      // --- Trending: click.buy_now activity over last 30 days ---
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trendingAgg = await ActivityLog.aggregate([
        { $match: { action: "click.buy_now", createdAt: { $gte: since } } },
        { $group: { _id: "$metadata.productId", clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $limit: 12 },
      ]);
      let trendingIds = trendingAgg
        .map((t) => t._id)
        .filter(
          (id) =>
            id &&
            typeof id === "string" &&
            /^[0-9a-fA-F]{24}$/.test(id) &&
            String(id) !== String(product._id)
        );
      let trendingFallback = false;
      if (!trendingIds.length) {
        // Cold start: no click data — fall back to newest products.
        trendingFallback = true;
        trendingIds = [];
      }
      const trendingDocs = trendingIds.length
        ? Product.find({ _id: { $in: trendingIds }, archived: { $ne: true } })
            .select("title brand images category createdAt")
            .lean()
        : Product.find({ _id: { $ne: product._id }, archived: { $ne: true } })
            .select("title brand images category createdAt")
            .sort({ createdAt: -1 })
            .limit(12)
            .lean();
      const trendingList = await trendingDocs;
      const clickMap = new Map(trendingAgg.map((t) => [String(t._id), t.clicks]));

      // --- Attach best prices for both sets in one aggregate each ---
      const allIds = [...new Set([...relatedDocs, ...trendingList].map((d) => String(d._id)))].map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const priceMap = await bestPricesForProducts(allIds, activeStoreIds);

      function toItem(doc) {
        const p = priceMap.get(String(doc._id));
        return {
          id: doc._id,
          title: doc.title,
          brand: doc.brand,
          image: doc.images?.[0] || null,
          bestPrice: p?.bestPrice ?? null,
          hasStock: Boolean(p?.hasStock),
          listingCount: p?.listingCount ?? 0,
          clicks: clickMap.get(String(doc._id)) ?? null,
        };
      }

      // Related: prefer in-stock, then cheapest. Exclude items with no listings.
      const related = relatedDocs
        .map(toItem)
        .filter((item) => item.listingCount > 0)
        .sort((a, b) => {
          if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
          return (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity);
        })
        .slice(0, 6);

      // Trending: preserve click order (or newest order in fallback).
      const trending = trendingList
        .map(toItem)
        .filter((item) => item.listingCount > 0)
        .slice(0, 6);

      res.json({
        success: true,
        data: {
          related,
          trending,
          trendingFallback,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ---------- GET /api/go/:listingId ---------- */
router.get("/go/:listingId", validate(listingIdParamSchema, "params"), async (req, res, next) => {
    try {
      const listing = await StoreListing.findById(req.params.listingId)
        .populate("store", "slug name active")
        .populate("product", "archived")
        .lean();
      if (!listing) throw ApiError.notFound("Listing not found");
      if (listing.archived) throw ApiError.notFound("Listing is no longer available");
      if (listing.store && listing.store.active === false) {
        throw ApiError.notFound("This store is currently unavailable");
      }
      if (listing.product?.archived) {
        throw ApiError.notFound("This product is no longer available");
      }

    const target = listing.affiliateUrl || listing.url;
    if (!target || !/^https?:\/\//.test(target)) {
      throw ApiError.notFound("No valid destination for this listing");
    }

    await ActivityLog.create({
      actor: req.user?._id ?? null,
      action: "click.buy_now",
      entityType: "StoreListing",
      entityId: String(listing._id),
      metadata: {
        productId: String(listing.product),
        store: listing.store?.slug,
        ip: req.ip,
        userAgent: (req.headers["user-agent"] || "").slice(0, 300),
      },
    });

    res.redirect(302, target);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { formatINR, availabilityMeta } from "../../lib/format";

function PlaceholderImage() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-neutral-100"
      aria-hidden="true"
    >
      <svg
        className="h-12 w-12 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm10.5-11.25h.008v.008h-.008V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
    </div>
  );
}

export function ProductCard({ product }) {
  const {
    id,
    title,
    brand,
    image,
    bestPrice,
    maxMrp,
    maxDiscount,
    storeCount,
    listingCount,
    hasStock,
  } = product;

  const availability = hasStock ? availabilityMeta.in_stock : availabilityMeta.out_of_stock;

  return (
    <Link
      to={`/product/${id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-soft transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-50">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderImage />
        )}
        {maxDiscount > 0 && (
          <span className="absolute left-3 top-3">
            <Badge tone="success">{maxDiscount}% off</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">
          {brand || "Unbranded"}
        </p>
        <h3 className="line-clamp-2 text-body font-medium leading-snug text-neutral-900">
          {title}
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-2">
          <span className="text-title-3 font-semibold text-neutral-900">
            {formatINR(bestPrice)}
          </span>
          {maxMrp && maxMrp > bestPrice && (
            <span className="text-caption text-neutral-500 line-through">
              {formatINR(maxMrp)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={availability.tone}>{availability.label}</Badge>
          {(storeCount != null || listingCount != null) && (
            <span className="text-caption text-neutral-500">
              {storeCount === 1
                ? "1 store"
                : storeCount != null
                  ? `${storeCount} stores`
                  : ""}
              {storeCount != null && listingCount > storeCount
                ? ` · ${listingCount} offers`
                : storeCount == null && listingCount != null
                  ? `${listingCount} offers`
                  : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      role="status"
      aria-label="Loading product"
    >
      <div className="skeleton aspect-square w-full" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-6 w-24" />
      </div>
      <span className="sr-only">Loading product…</span>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

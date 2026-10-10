import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProduct,
  fetchPriceHistory,
  fetchRecommendations,
} from "../store/catalogSlice";
import {
  toggleWishlist,
  createAlert,
  clearAlertResult,
} from "../store/userSlice";
import { PriceHistoryChart } from "../components/catalog/PriceHistoryChart";
import { ProductCard, ProductCardSkeleton } from "../components/catalog/ProductCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Card } from "../components/ui/Card";
import {
  formatINR,
  formatDateTime,
  availabilityMeta,
} from "../lib/format";

function Gallery({ images, title }) {
  const [active, setActive] = useState(0);
  const list = images || [];

  useEffect(() => {
    setActive(0);
  }, [images]);

  if (list.length === 0) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-lg bg-neutral-100"
        aria-hidden="true"
      >
        <svg className="h-16 w-16 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm10.5-11.25h.008v.008h-.008V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <img
          src={list[active]}
          alt={`${title} — image ${active + 1} of ${list.length}`}
          className="h-full w-full object-cover"
        />
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2" role="group" aria-label="Product images">
          {list.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === active}
              className={`h-16 w-16 overflow-hidden rounded-md border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                i === active ? "border-primary-500" : "border-transparent hover:border-neutral-300"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingRow({ listing, isBest }) {
  const meta = availabilityMeta[listing.availability] || availabilityMeta.unknown;
  const buyable = listing.availability === "in_stock";
  const destination = `/api/go/${listing.id}`;

  return (
    <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-body font-semibold text-neutral-900">
            {listing.store?.name || "Store"}
          </h3>
          {isBest && <Badge tone="primary">Best price</Badge>}
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        {listing.deliveryInfo && Object.keys(listing.deliveryInfo).length > 0 && (
          <p className="mt-1 text-caption text-neutral-600">
            {Object.entries(listing.deliveryInfo)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </p>
        )}
        <p className="mt-1 text-caption text-neutral-500">
          Updated {formatDateTime(listing.lastSyncedAt)}
        </p>
      </div>

      <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-1">
        <div className="text-right">
          <p className="text-title-3 font-semibold text-neutral-900">
            {formatINR(listing.currentPrice)}
          </p>
          {listing.mrp && listing.mrp > listing.currentPrice && (
            <p className="text-caption text-neutral-500">
              <span className="line-through">{formatINR(listing.mrp)}</span>
              {listing.discountPercent ? ` · ${listing.discountPercent}% off` : ""}
            </p>
          )}
        </div>
        {buyable ? (
          <a
            href={destination}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-500 px-5 text-body-sm font-medium text-white transition-colors hover:bg-primary-600 active:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label={`Buy ${listing.store?.name || "product"} at ${formatINR(listing.currentPrice)} (opens store in a new tab)`}
          >
            Buy Now
          </a>
        ) : (
          <span
            className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-md bg-neutral-100 px-5 text-body-sm font-medium text-neutral-500"
            aria-disabled="true"
          >
            Unavailable
          </span>
        )}
      </div>
    </div>
  );
}

function ProductActions({ product, wishlisted, bestPrice }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((s) => s.auth);
  const { alerts } = useSelector((s) => s.user);
  const [toggling, setToggling] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [target, setTarget] = useState(
    bestPrice ? String(Math.max(1, Math.floor(bestPrice * 0.9))) : ""
  );
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertError, setAlertError] = useState(null);

  useEffect(() => {
    if (bestPrice) {
      setTarget((prev) =>
        prev === "" ? String(Math.max(1, Math.floor(bestPrice * 0.9))) : prev
      );
    }
  }, [bestPrice]);

  async function handleWishlistToggle() {
    setToggling(true);
    setAnnouncement("");
    const next = !wishlisted;
    const result = await dispatch(
      toggleWishlist({ productId: product.id, wished: next })
    );
    setToggling(false);
    if (!result.error) {
      setAnnouncement(next ? "Saved to wishlist." : "Removed from wishlist.");
    } else {
      setAnnouncement(result.payload?.message || "Could not update wishlist.");
    }
  }

  async function handleAlertSubmit(event) {
    event.preventDefault();
    setAlertSubmitting(true);
    setAlertError(null);
    const result = await dispatch(
      createAlert({ productId: product.id, targetPrice: Number(target) })
    );
    setAlertSubmitting(false);
    if (result.error) {
      setAlertError(result.payload || { message: "Could not create alert." });
    } else {
      setShowAlertForm(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => navigate("/login")}
          aria-label="Sign in to save this product"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          Sign in to save
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate("/login")}
          aria-label="Sign in to set a price alert"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          Sign in for alerts
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={wishlisted ? "primary" : "secondary"}
          onClick={handleWishlistToggle}
          disabled={toggling}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill={wishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          {toggling ? "…" : wishlisted ? "Saved" : "Save"}
        </Button>

        {!showAlertForm && (
          <Button
            variant="secondary"
            onClick={() => {
              setShowAlertForm(true);
              setAlertError(null);
              dispatch(clearAlertResult());
            }}
            aria-label="Set a price alert for this product"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Set price alert
          </Button>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {alerts.lastResult && !showAlertForm && (
        <p
          className={`mt-3 rounded-md border px-4 py-3 text-body-sm ${
            alerts.lastResult.triggeredNow
              ? "border-success-100 bg-success-50 text-success-700"
              : "border-primary-100 bg-primary-50 text-primary-700"
          }`}
          role="status"
        >
          {alerts.lastResult.triggeredNow
            ? `Target of ${formatINR(alerts.lastResult.targetPrice)} is already met — we've sent you a notification.`
            : alerts.lastResult.alreadyExists
              ? "You already have this exact alert."
              : `Alert set. We'll notify you when the price reaches ${formatINR(alerts.lastResult.targetPrice)}.`}
        </p>
      )}

      {showAlertForm && (
        <Card className="mt-3 p-5">
          <form onSubmit={handleAlertSubmit} aria-label="Set price alert">
            <label
              htmlFor="alert-target"
              className="text-body-sm font-medium text-neutral-900"
            >
              Notify me when the price reaches
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="relative flex-1">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-neutral-500"
                >
                  ₹
                </span>
                <input
                  id="alert-target"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-describedby="alert-target-help"
                  className="h-11 w-full rounded-md border border-neutral-300 pl-7 pr-3 text-body text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              <Button type="submit" loading={alertSubmitting}>
                Create alert
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAlertForm(false);
                  setAlertError(null);
                  dispatch(clearAlertResult());
                }}
              >
                Cancel
              </Button>
            </div>
            <p id="alert-target-help" className="mt-2 text-caption text-neutral-500">
              {bestPrice
                ? `Current best price is ${formatINR(bestPrice)}.`
                : "No current price — the alert will evaluate once listings appear."}
            </p>
            {alertError && (
              <p className="mt-3 text-body-sm text-danger-700" role="alert">
                {alertError.message}
              </p>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}

export function ProductPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail, history, recommendations } = useSelector((s) => s.catalog);

  useEffect(() => {
    dispatch(fetchProduct(id));
    dispatch(fetchPriceHistory({ id, days: 90 }));
    dispatch(fetchRecommendations(id));
    dispatch(clearAlertResult());
  }, [dispatch, id]);

  const isNotFound =
    detail.status === "failed" && detail.error?.status === 404 && detail.activeId === id;

  if (isNotFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Product not found"
          description="This product may have been removed or the link is invalid."
          actionLabel="Back to search"
          onAction={() => navigate("/search")}
        />
      </div>
    );
  }

  if (detail.status === "failed" && detail.activeId === id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState
          title="Cannot load product"
          message={detail.error?.message || "The API did not respond."}
          onRetry={() => dispatch(fetchProduct(id))}
        />
      </div>
    );
  }

  const loading = detail.status === "loading" || detail.activeId !== id;
  const product = detail.product;
  const listings = detail.listings;
  const summary = detail.summary;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {loading ? (
        <div role="status" aria-label="Loading product" className="space-y-6">
          <Skeleton className="h-5 w-64" />
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
          <span className="sr-only">Loading product…</span>
        </div>
      ) : (
        <>
          <nav aria-label="Breadcrumb" className="text-body-sm text-neutral-500">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/" className="hover:text-primary-600 hover:underline">Home</Link></li>
              <li aria-hidden="true">/</li>
              {product.category?.slug && (
                <>
                  <li>
                    <Link to={`/category/${product.category.slug}`} className="hover:text-primary-600 hover:underline">
                      {product.category.name}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                </>
              )}
              <li aria-current="page" className="max-w-[240px] truncate font-medium text-neutral-900 sm:max-w-md">
                {product.title}
              </li>
            </ol>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <Gallery images={product.images} title={product.title} />

            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">
                {product.brand || "Unbranded"}
              </p>
              <h1 className="mt-1 text-title-1 font-semibold leading-tight text-neutral-900">
                {product.title}
              </h1>
              {product.variant && (product.variant.color || product.variant.name || product.variant.size) && (
                <p className="mt-2 text-body-sm text-neutral-600">
                  {[product.variant.color, product.variant.name, product.variant.size]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              <ProductActions
                product={product}
                wishlisted={detail.wishlisted}
                bestPrice={summary?.bestPrice ?? null}
              />

              {summary?.bestPrice != null ? (
                <Card className="mt-6 p-5">
                  <p className="text-caption font-semibold uppercase tracking-wide text-neutral-600">
                    Best price
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span className="text-display-sm font-bold text-neutral-900">
                      {formatINR(summary.bestPrice)}
                    </span>
                    {summary.maxMrp && summary.maxMrp > summary.bestPrice && (
                      <span className="text-body text-neutral-500 line-through">
                        {formatINR(summary.maxMrp)}
                      </span>
                    )}
                  </div>
                  {summary.savings > 0 && (
                    <p className="mt-2 text-body-sm font-medium text-success-700">
                      You save {formatINR(summary.savings)} vs the highest MRP
                    </p>
                  )}
                  <p className="mt-2 text-body-sm text-neutral-600">
                    {summary.storeCount === 1
                      ? "Available at 1 store"
                      : `Lowest of ${summary.storeCount} stores`}
                    {summary.hasStock ? "" : " · currently out of stock everywhere"}
                  </p>
                </Card>
              ) : (
                <Card className="mt-6 p-5">
                  <p className="text-body-sm text-neutral-600">
                    No active listings for this product right now. Check back
                    after the next store sync.
                  </p>
                </Card>
              )}

              {Object.keys(product.specs || {}).length > 0 && (
                <section aria-labelledby="specs-heading" className="mt-8">
                  <h2 id="specs-heading" className="text-title-3 text-neutral-900">
                    Specifications
                  </h2>
                  <dl className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="flex gap-4 px-4 py-3 text-body-sm">
                        <dt className="w-32 shrink-0 font-medium text-neutral-600">{key}</dt>
                        <dd className="text-neutral-900">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          </div>

          <section aria-labelledby="compare-heading" className="mt-12">
            <h2 id="compare-heading" className="text-title-2 font-semibold text-neutral-900">
              Compare prices across stores
            </h2>
            <p className="mt-1 text-body-sm text-neutral-600">
              {listings.length === 0
                ? "No listings available."
                : `${listings.length} offer${listings.length === 1 ? "" : "s"}, lowest first.`}
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {listings.length === 0 ? (
                <div className="px-5 py-10 text-center text-body-sm text-neutral-600">
                  This product has no store listings yet. Listings appear
                  automatically when stores are synced.
                </div>
              ) : (
                listings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    isBest={listing.id === summary?.bestListingId}
                  />
                ))
              )}
            </div>
          </section>

          <section aria-labelledby="history-heading" className="mt-12">
            <h2 id="history-heading" className="text-title-2 font-semibold text-neutral-900">
              Price history
            </h2>
            <p className="mt-1 text-body-sm text-neutral-600">
              Daily lowest price across all stores, last 90 days.
            </p>
            <div className="mt-4">
              <PriceHistoryChart
                points={history.activeId === id ? history.points : []}
                days={90}
                status={history.activeId === id ? history.status : "loading"}
                error={history.error}
                onRetry={() => dispatch(fetchPriceHistory({ id, days: 90 }))}
              />
            </div>
          </section>

          <RecommendationsSection
            recommendations={recommendations}
            activeId={id}
            onRetry={() => dispatch(fetchRecommendations(id))}
          />
        </>
      )}
    </div>
  );
}

function RecommendationsSection({ recommendations, activeId, onRetry }) {
  const isCurrent = recommendations.activeId === activeId;
  const related = isCurrent ? recommendations.related : [];
  const trending = isCurrent ? recommendations.trending : [];
  const trendingFallback = isCurrent && recommendations.trendingFallback;
  const loading = recommendations.status === "loading" || !isCurrent;
  const failed = recommendations.status === "failed" && isCurrent;

  // Hide entirely on failure (non-essential content); show skeletons while loading.
  if (failed && related.length === 0 && trending.length === 0) return null;
  if (!loading && related.length === 0 && trending.length === 0) return null;

  return (
    <>
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="text-title-2 font-semibold text-neutral-900">
            Related products
          </h2>
          <p className="mt-1 text-body-sm text-neutral-600">
            Similar items in the same category or from the same brand.
          </p>
          <div className="mt-4">
            {loading && related.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section aria-labelledby="trending-heading" className="mt-12">
          <div className="flex items-center gap-2">
            <h2 id="trending-heading" className="text-title-2 font-semibold text-neutral-900">
              {trendingFallback ? "Popular right now" : "Trending now"}
            </h2>
            {trendingFallback && (
              <Badge tone="neutral">New to the catalog</Badge>
            )}
          </div>
          <p className="mt-1 text-body-sm text-neutral-600">
            {trendingFallback
              ? "Be the first to compare these — no purchase activity yet."
              : "Most compared products in the last 30 days."}
          </p>
          <div className="mt-4">
            {loading && trending.length === 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trending.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {loading && related.length === 0 && trending.length === 0 && (
        <div role="status" aria-label="Loading recommendations" className="mt-12">
          <div className="skeleton h-7 w-48 rounded" />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
          <span className="sr-only">Loading recommendations…</span>
        </div>
      )}

      {failed && (
        <div className="mt-12">
          <ErrorState
            title="Cannot load recommendations"
            message={recommendations.error?.message || "The API did not respond."}
            onRetry={onRetry}
          />
        </div>
      )}
    </>
  );
}

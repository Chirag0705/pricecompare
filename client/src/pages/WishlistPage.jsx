import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchWishlist, toggleWishlist } from "../store/userSlice";
import { formatINR } from "../lib/format";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";

function WishCard({ item, onRemove, removing }) {
  const { product, bestPrice, listingCount } = item;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-soft">
      <Link
        to={`/product/${product.id}`}
        className="group relative block aspect-square w-full overflow-hidden bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
      >
        {product.image ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <svg className="h-12 w-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">
          {product.brand || "Unbranded"}
        </p>
        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 text-body font-medium leading-snug text-neutral-900 hover:text-primary-600"
        >
          {product.title}
        </Link>
        <div className="mt-auto pt-2">
          {bestPrice !== null ? (
            <p className="text-title-3 font-semibold text-neutral-900">
              {formatINR(bestPrice)}
              {listingCount > 1 && (
                <span className="ml-2 text-caption font-normal text-neutral-500">
                  best of {listingCount} offers
                </span>
              )}
            </p>
          ) : (
            <Badge tone="neutral">No offers right now</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={removing}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-neutral-300 bg-white text-body-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          aria-label={`Remove ${product.title} from wishlist`}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

export function WishlistPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { wishlist } = useSelector((s) => s.user);
  const [removingId, setRemovingId] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  async function handleRemove(item) {
    setRemovingId(item.id);
    setAnnouncement("");
    const result = await dispatch(
      toggleWishlist({ productId: item.product.id, wished: false })
    );
    setRemovingId(null);
    if (!result.error) {
      setAnnouncement(`${item.product.title} removed from wishlist.`);
    } else {
      setAnnouncement(
        `Could not remove ${item.product.title}. ${result.payload?.message || ""}`
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title-1 font-semibold text-neutral-900">Wishlist</h1>
        {wishlist.status === "succeeded" && wishlist.total > 0 && (
          <p className="text-body-sm text-neutral-600" aria-live="polite">
            {wishlist.total} saved
          </p>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {wishlist.actionError && (
        <p className="mt-4 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-body-sm text-danger-700" role="alert">
          {wishlist.actionError.message || "Something went wrong."}
        </p>
      )}

      <div className="mt-6">
        {wishlist.status === "loading" && (
          <div role="status" aria-label="Loading wishlist" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-neutral-200">
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            ))}
            <span className="sr-only">Loading wishlist…</span>
          </div>
        )}

        {wishlist.status === "failed" && (
          <ErrorState
            title="Cannot load wishlist"
            message={wishlist.error?.message || "The API did not respond."}
            onRetry={() => dispatch(fetchWishlist())}
          />
        )}

        {wishlist.status === "succeeded" &&
          (wishlist.items.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              description="Tap the heart on any product to save it here and track its price."
              actionLabel="Browse products"
              onAction={() => navigate("/search")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wishlist.items.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  removing={removingId === item.id}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

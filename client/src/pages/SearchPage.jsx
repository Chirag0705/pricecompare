import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchSearch, fetchStores, fetchCategories } from "../store/catalogSlice";
import {
  ProductGrid,
  ProductGridSkeleton,
} from "../components/catalog/ProductCard";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";

const SORT_OPTIONS_WITH_Q = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "discount", label: "Biggest Discount" },
  { value: "newest", label: "Newest" },
];

const SORT_OPTIONS_NO_Q = SORT_OPTIONS_WITH_Q.filter((o) => o.value !== "relevance");

function flattenCategories(tree, depth = 0, out = []) {
  for (const c of tree) {
    out.push({ id: c._id, slug: c.slug, name: c.name, depth });
    if (c.children?.length) flattenCategories(c.children, depth + 1, out);
  }
  return out;
}

function parseParams(searchParams) {
  const get = (k) => searchParams.get(k) || undefined;
  const q = get("q");
  const sort = get("sort") || (q ? "relevance" : "newest");
  return {
    q,
    category: get("category"),
    brand: get("brand"),
    minPrice: get("minPrice") ? Number(get("minPrice")) : undefined,
    maxPrice: get("maxPrice") ? Number(get("maxPrice")) : undefined,
    store: get("store"),
    availability: get("availability"),
    sort,
    page: Number(get("page")) || 1,
    limit: 12,
  };
}

function activeFilterCount(params) {
  return ["category", "brand", "minPrice", "maxPrice", "store", "availability"].filter(
    (k) => params[k]
  ).length;
}

function FiltersForm({
  params,
  flatCategories,
  stores,
  brands,
  onFilter,
  onClear,
}) {
  const [minDraft, setMinDraft] = useState(params.minPrice ?? "");
  const [maxDraft, setMaxDraft] = useState(params.maxPrice ?? "");

  useEffect(() => {
    setMinDraft(params.minPrice ?? "");
    setMaxDraft(params.maxPrice ?? "");
  }, [params.minPrice, params.maxPrice]);

  function commitPrices(event) {
    event.preventDefault();
    onFilter("minPrice", minDraft === "" ? undefined : String(minDraft));
    onFilter("maxPrice", maxDraft === "" ? undefined : String(maxDraft));
  }

  const sectionClass = "border-b border-neutral-200 py-5 first:pt-0 last:border-0 last:pb-0";
  const legendClass = "text-caption font-semibold uppercase tracking-wide text-neutral-600";
  const labelClass = "flex min-h-[44px] cursor-pointer items-center gap-3 text-body-sm text-neutral-900";

  return (
    <form aria-label="Search filters" onSubmit={commitPrices}>
      <fieldset className={sectionClass}>
        <legend className={legendClass}>Category</legend>
        <label htmlFor="filter-category" className="sr-only">Filter by category</label>
        <select
          id="filter-category"
          value={params.category || ""}
          onChange={(e) => onFilter("category", e.target.value || undefined)}
          className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-body-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          <option value="">All categories</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.slug}>
              {" ".repeat(c.depth * 3)}
              {c.name}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Brand</legend>
        <div className="mt-1 max-h-52 overflow-y-auto" role="group" aria-label="Filter by brand">
          {brands.length === 0 && (
            <p className="py-2 text-body-sm text-neutral-500">No brands in results.</p>
          )}
          {brands.map((b) => (
            <label key={b.brand} className={labelClass}>
              <input
                type="checkbox"
                name="brand"
                value={b.brand}
                checked={params.brand === b.brand}
                onChange={(e) =>
                  onFilter("brand", e.target.checked ? b.brand : undefined)
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="flex-1 truncate">{b.brand}</span>
              <span className="text-caption text-neutral-500">{b.count}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Store</legend>
        <div className="mt-1" role="group" aria-label="Filter by store">
          {stores.map((s) => (
            <label key={s.slug} className={labelClass}>
              <input
                type="checkbox"
                name="store"
                value={s.slug}
                checked={params.store === s.slug}
                onChange={(e) =>
                  onFilter("store", e.target.checked ? s.slug : undefined)
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="flex-1">{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Price (₹)</legend>
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="filter-min" className="sr-only">Minimum price</label>
          <input
            id="filter-min"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min"
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-neutral-300 px-3 text-body-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <span aria-hidden="true" className="text-neutral-400">–</span>
          <label htmlFor="filter-max" className="sr-only">Maximum price</label>
          <input
            id="filter-max"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max"
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md border border-neutral-300 px-3 text-body-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="mt-3 w-full">
          Apply price range
        </Button>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend className={legendClass}>Availability</legend>
        <label className={labelClass}>
          <input
            type="checkbox"
            checked={params.availability === "in_stock"}
            onChange={(e) =>
              onFilter("availability", e.target.checked ? "in_stock" : undefined)
            }
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
          />
          In stock only
        </label>
      </fieldset>

      <div className="pt-5">
        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onClear}>
          Clear all filters
        </Button>
      </div>
    </form>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Search results pages" className="mt-8 flex items-center justify-center gap-4">
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        ← Previous
      </Button>
      <span className="text-body-sm text-neutral-600" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        Next →
      </Button>
    </nav>
  );
}

export function SearchPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, stores, categories } = useSelector((s) => s.catalog);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(searchParams.get("q") || "");

  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  const flatCategories = useMemo(() => flattenCategories(categories.tree), [categories.tree]);
  const filterCount = activeFilterCount(params);

  useEffect(() => {
    if (stores.status === "idle") dispatch(fetchStores());
    if (categories.status === "idle") dispatch(fetchCategories());
  }, [dispatch, stores.status, categories.status]);

  useEffect(() => {
    setQueryDraft(params.q || "");
    dispatch(fetchSearch(params));
  }, [dispatch, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === "" || value === null) next.delete(key);
    else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (params.q) next.set("q", params.q);
    setSearchParams(next);
  }

  function goToPage(p) {
    setParam("page", p === 1 ? undefined : String(p));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleQuerySubmit(event) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const q = queryDraft.trim();
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next);
  }

  const sortOptions = params.q ? SORT_OPTIONS_WITH_Q : SORT_OPTIONS_NO_Q;
  const isLoading = search.status === "loading";
  const hasResults = search.items.length > 0;

  const chips = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”`, clearable: false });
  if (params.category) chips.push({ key: "category", label: `Category: ${params.category}` });
  if (params.brand) chips.push({ key: "brand", label: `Brand: ${params.brand}` });
  if (params.store) {
    const storeName = stores.items.find((s) => s.slug === params.store)?.name || params.store;
    chips.push({ key: "store", label: `Store: ${storeName}` });
  }
  if (params.minPrice || params.maxPrice) {
    chips.push({
      key: "price",
      label: `Price: ${params.minPrice || "0"} – ${params.maxPrice || "∞"}`,
    });
  }
  if (params.availability === "in_stock") {
    chips.push({ key: "availability", label: "In stock only" });
  }

  function removeChip(key) {
    const next = new URLSearchParams(searchParams);
    if (key === "price") {
      next.delete("minPrice");
      next.delete("maxPrice");
    } else {
      next.delete(key);
    }
    next.delete("page");
    setSearchParams(next);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <form role="search" aria-label="Search products" onSubmit={handleQuerySubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="search-page-input" className="sr-only">Search products</label>
          <input
            id="search-page-input"
            type="search"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Search products…"
            maxLength={200}
            className="h-12 w-full rounded-lg border border-neutral-300 bg-white pl-11 pr-4 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>
        <Button type="submit" className="sm:w-auto">Search</Button>
      </form>

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
        <aside aria-label="Filters" className="mb-6 lg:mb-0">
          <div className="lg:hidden">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="mobile-filters"
            >
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
            </Button>
          </div>
          <div
            id="mobile-filters"
            className={`${filtersOpen ? "block" : "hidden"} mt-4 rounded-lg border border-neutral-200 bg-white p-5 lg:mt-0 lg:block lg:border-0 lg:p-0 lg:shadow-none`}
          >
            <FiltersForm
              params={params}
              flatCategories={flatCategories}
              stores={stores.items}
              brands={search.availableBrands}
              onFilter={setParam}
              onClear={clearFilters}
            />
          </div>
        </aside>

        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-title-2 font-semibold text-neutral-900">
                {params.q ? `Results for “${params.q}”` : "All products"}
              </h1>
              <p className="mt-1 text-body-sm text-neutral-600" aria-live="polite">
                {isLoading && !hasResults
                  ? "Loading…"
                  : `${search.total} product${search.total === 1 ? "" : "s"} found`}
              </p>
            </div>
            <div>
              <label htmlFor="sort-select" className="sr-only">Sort results</label>
              <select
                id="sort-select"
                value={params.sort}
                onChange={(e) => setParam("sort", e.target.value)}
                className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-body-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-auto"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Active filters">
              {chips.map((chip) => (
                <span
                  key={chip.key}
                  role="listitem"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-primary-100 bg-primary-50 pl-3 pr-1.5 text-body-sm text-primary-700"
                >
                  {chip.label}
                  {chip.clearable !== false && (
                    <button
                      type="button"
                      onClick={() => removeChip(chip.key)}
                      aria-label={`Remove filter ${chip.label}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className={`mt-6 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading || undefined}>
            {search.status === "failed" ? (
              <ErrorState
                title="Search failed"
                message={search.error?.message || "Something went wrong while searching."}
                onRetry={() => dispatch(fetchSearch(params))}
              />
            ) : isLoading && !hasResults ? (
              <ProductGridSkeleton count={9} />
            ) : hasResults ? (
              <>
                <ProductGrid items={search.items} />
                <p className="sr-only" role="status">
                  Showing {search.items.length} of {search.total} products.
                </p>
              </>
            ) : (
              <EmptyState
                title="No products match"
                description={
                  filterCount > 0
                    ? "Try removing some filters or searching for a different term."
                    : "Try a different search term."
                }
                actionLabel={filterCount > 0 ? "Clear filters" : undefined}
                onAction={filterCount > 0 ? clearFilters : undefined}
              />
            )}
          </div>

          {search.status === "succeeded" && (
            <Pagination page={search.page} totalPages={search.totalPages} onPage={goToPage} />
          )}

          <p className="mt-8 text-center text-caption text-neutral-500">
            <Link to="/" className="hover:text-primary-600 hover:underline">Home</Link>
            {" / "}
            {params.q ? "Search" : "All products"}
          </p>
        </div>
      </div>
    </div>
  );
}

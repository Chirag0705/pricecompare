import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories, fetchSearch } from "../store/catalogSlice";
import { ProductGrid, ProductGridSkeleton } from "../components/catalog/ProductCard";
import { SearchAutocomplete } from "../components/search/SearchAutocomplete";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";

export function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { categories, search } = useSelector((s) => s.catalog);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (categories.status === "idle") {
      dispatch(fetchCategories());
    }
    dispatch(fetchSearch({ sort: "newest", limit: 8 }));
  }, [dispatch, categories.status]);

  function handleSearch(event) {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const rootCategories = categories.tree;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section aria-labelledby="hero-heading" className="text-center">
        <h1 id="hero-heading" className="mx-auto max-w-2xl text-display text-neutral-900">
          Find the best price, everywhere.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-body text-neutral-600">
          Compare live prices across Amazon, Flipkart, and Myntra. One product,
          every store, the lowest price first.
        </p>

        <form
          role="search"
          aria-label="Product search"
          onSubmit={handleSearch}
          className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        >
          <div className="flex-1">
            <SearchAutocomplete
              id="home-search"
              value={query}
              onChange={setQuery}
              onSubmit={handleSearch}
              placeholder="Search phones, laptops, shoes…"
              inputClassName="h-12 pl-11 text-body"
            />
          </div>
          <Button type="submit" size="lg" className="sm:w-auto">
            Search
          </Button>
        </form>
      </section>

      <section aria-labelledby="categories-heading" className="mt-12">
        <h2 id="categories-heading" className="text-title-3 text-neutral-900">
          Browse categories
        </h2>
        {categories.status === "loading" && rootCategories.length === 0 && (
          <div role="status" aria-label="Loading categories" className="mt-4 flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-11 w-32 rounded-lg" />
            ))}
            <span className="sr-only">Loading categories…</span>
          </div>
        )}
        {categories.status === "failed" && (
          <div className="mt-4">
            <ErrorState
              title="Cannot load categories"
              message={categories.error?.message || "The API did not respond."}
              onRetry={() => dispatch(fetchCategories())}
            />
          </div>
        )}
        {categories.status === "succeeded" && (
          <div className="mt-4 flex flex-wrap gap-3">
            {rootCategories.map((cat) => (
              <Link
                key={cat._id}
                to={`/category/${cat.slug}`}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-neutral-200 bg-white px-5 text-body-sm font-medium text-neutral-900 shadow-soft transition-colors hover:border-primary-500 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="newest-heading" className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 id="newest-heading" className="text-title-3 text-neutral-900">
            New arrivals
          </h2>
          <Link
            to="/search?sort=newest"
            className="text-body-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="mt-6">
          {search.status === "loading" && (
            <ProductGridSkeleton count={8} />
          )}
          {search.status === "failed" && (
            <ErrorState
              title="Cannot load products"
              message={search.error?.message || "The API did not respond."}
              onRetry={() => dispatch(fetchSearch({ sort: "newest", limit: 8 }))}
            />
          )}
          {search.status === "succeeded" &&
            (search.items.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="The catalog is empty. Products appear here as soon as they are synced from stores."
              />
            ) : (
              <ProductGrid items={search.items} />
            ))}
        </div>
      </section>
    </div>
  );
}

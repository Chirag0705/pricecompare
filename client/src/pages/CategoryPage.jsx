import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories, fetchSearch } from "../store/catalogSlice";
import {
  ProductGrid,
  ProductGridSkeleton,
} from "../components/catalog/ProductCard";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";

function findCategory(tree, slug) {
  for (const node of tree) {
    if (node.slug === slug) return { node, parent: null };
    if (node.children?.length) {
      const found = findCategory(node.children, slug);
      if (found) return { node: found.node, parent: node };
    }
  }
  return null;
}

export function CategoryPage() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { categories, search } = useSelector((s) => s.catalog);

  useEffect(() => {
    if (categories.status === "idle") dispatch(fetchCategories());
  }, [dispatch, categories.status]);

  useEffect(() => {
    dispatch(fetchSearch({ category: slug, sort: "newest", limit: 24 }));
  }, [dispatch, slug]);

  const match = useMemo(
    () => (categories.tree.length ? findCategory(categories.tree, slug) : null),
    [categories.tree, slug]
  );

  const notFound =
    categories.status === "succeeded" && categories.tree.length > 0 && !match;

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Category not found"
          description={`We could not find a category with the address “${slug}”.`}
          actionLabel="Browse all categories"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  const node = match?.node;
  const parent = match?.parent;
  const children = node?.children || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-body-sm text-neutral-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-primary-600 hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          {parent && (
            <>
              <li>
                <Link to={`/category/${parent.slug}`} className="hover:text-primary-600 hover:underline">
                  {parent.name}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
            </>
          )}
          <li aria-current="page" className="font-medium text-neutral-900">
            {node?.name || "Category"}
          </li>
        </ol>
      </nav>

      <div className="mt-4">
        <h1 className="text-title-1 font-semibold text-neutral-900">
          {node?.name || "Category"}
        </h1>
        {search.status === "succeeded" && (
          <p className="mt-1 text-body-sm text-neutral-600" aria-live="polite">
            {search.total} product{search.total === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {children.length > 0 && (
        <nav aria-label="Subcategories" className="mt-6">
          <h2 className="sr-only">Subcategories</h2>
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <Link
                key={child._id}
                to={`/category/${child.slug}`}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-neutral-200 bg-white px-4 text-body-sm font-medium text-neutral-900 transition-colors hover:border-primary-500 hover:text-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                {child.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <div className="mt-8">
        {search.status === "loading" && <ProductGridSkeleton count={8} />}
        {search.status === "failed" && (
          <ErrorState
            title="Cannot load products"
            message={search.error?.message || "The API did not respond."}
            onRetry={() => dispatch(fetchSearch({ category: slug, sort: "newest", limit: 24 }))}
          />
        )}
        {search.status === "succeeded" &&
          (search.items.length === 0 ? (
            <EmptyState
              title="No products in this category yet"
              description="Products appear here as soon as they are synced from stores."
            />
          ) : (
            <ProductGrid items={search.items} />
          ))}
      </div>

      <p className="mt-8 text-center text-caption text-neutral-500">
        <Link
          to={`/search?category=${encodeURIComponent(slug)}&sort=newest`}
          className="text-primary-600 hover:underline"
        >
          Open in search with filters
        </Link>
      </p>
    </div>
  );
}

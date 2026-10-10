import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminProducts,
  createAdminProduct,
  clearAdminAction,
} from "../../store/adminSlice";
import { fieldErrorsFrom } from "../../lib/axios";
import { formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import {
  ActionBanner,
  AdminPagination,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

function NewProductForm({ onCreated }) {
  const dispatch = useDispatch();
  const { action } = useSelector((s) => s.admin);
  const [form, setForm] = useState({ title: "", brand: "", model: "", sku: "", gtin: "", images: "" });
  const fieldErrors = fieldErrorsFrom(action.error);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const body = {
      title: form.title.trim(),
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      sku: form.sku.trim() || undefined,
      identifiers: form.gtin.trim() ? { gtin: form.gtin.trim() } : undefined,
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const result = await dispatch(createAdminProduct(body));
    if (createAdminProduct.fulfilled.match(result)) {
      setForm({ title: "", brand: "", model: "", sku: "", gtin: "", images: "" });
      onCreated?.();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Create product">
      <div>
        <label htmlFor="np-title" className={labelClass}>
          Title <span className="text-danger-600" aria-hidden="true">*</span>
        </label>
        <input
          id="np-title"
          required
          minLength={3}
          value={form.title}
          onChange={set("title")}
          aria-invalid={fieldErrors.title ? "true" : undefined}
          className={inputClass}
        />
        {fieldErrors.title && (
          <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.title}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="np-brand" className={labelClass}>Brand</label>
          <input id="np-brand" value={form.brand} onChange={set("brand")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="np-model" className={labelClass}>Model</label>
          <input id="np-model" value={form.model} onChange={set("model")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="np-sku" className={labelClass}>SKU</label>
          <input id="np-sku" value={form.sku} onChange={set("sku")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="np-gtin" className={labelClass}>GTIN</label>
          <input id="np-gtin" value={form.gtin} onChange={set("gtin")} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="np-images" className={labelClass}>Image URLs (one per line)</label>
        <textarea
          id="np-images"
          rows={2}
          value={form.images}
          onChange={set("images")}
          className={`${inputClass} h-auto py-2`}
        />
      </div>
      <button
        type="submit"
        disabled={action.busy}
        className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        {action.busy ? "Creating…" : "Create product"}
      </button>
    </form>
  );
}

export function AdminProducts() {
  const dispatch = useDispatch();
  const { products, action } = useSelector((s) => s.admin);
  const [q, setQ] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = (page = 1) =>
    dispatch(
      fetchAdminProducts({
        q: q || undefined,
        includeArchived: includeArchived ? "true" : undefined,
        page,
      })
    );

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message && !showCreate) load(products.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title-2 font-semibold text-neutral-900">Products</h2>
          <p className="text-body-sm text-neutral-600">{products.total} total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          aria-expanded={showCreate}
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {showCreate ? "Close" : "New product"}
        </button>
      </div>

      <ActionBanner />

      {showCreate && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
          <h3 className="mb-3 text-headline text-neutral-900">Create product manually</h3>
          <NewProductForm onCreated={() => { setShowCreate(false); load(); }} />
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); load(1); }}
        className="flex flex-wrap items-end gap-3"
        role="search"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="prod-q" className={labelClass}>Search title or brand</label>
          <input
            id="prod-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            placeholder="e.g. iPhone"
          />
        </div>
        <label className="mb-2.5 inline-flex min-h-[44px] items-center gap-2 text-body-sm text-neutral-700">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          Include archived
        </label>
        <button
          type="submit"
          className="mb-0.5 inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          Search
        </button>
      </form>

      {products.status === "loading" && !products.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : products.status === "failed" ? (
        <ErrorState message={products.error?.message} onRetry={() => load()} />
      ) : products.items.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Adjust the search, or create a product manually."
        />
      ) : (
        <>
          <TableWrap caption="Admin products">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Title</Th>
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th className="text-right">Listings</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.items.map((p) => (
                <tr key={p._id} className="hover:bg-neutral-50">
                  <Td className="max-w-[280px]">
                    <Link
                      to={`/admin/products/${p._id}`}
                      className="line-clamp-2 font-medium text-primary-700 hover:text-primary-800"
                    >
                      {p.title}
                    </Link>
                  </Td>
                  <Td>{p.brand || "—"}</Td>
                  <Td>{p.category?.name || "—"}</Td>
                  <Td className="text-right">{p.listingCount ?? 0}</Td>
                  <Td>
                    {p.archived ? <StatusBadgeArchived /> : <Badge tone="success">Active</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(p.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <AdminPagination
            page={products.page}
            totalPages={products.totalPages}
            onPage={(p) => load(p)}
            label="products"
          />
        </>
      )}
    </div>
  );
}

function StatusBadgeArchived() {
  return <Badge tone="neutral">Archived</Badge>;
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminProduct,
  updateAdminProduct,
  mergeAdminProducts,
  attachAdminListing,
  clearAdminAction,
} from "../../store/adminSlice";
import { fieldErrorsFrom } from "../../lib/axios";
import { formatINR, formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { Badge } from "../../components/ui/Badge";
import {
  ActionBanner,
  AdminCard,
  StatusPill,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

function toForm(product) {
  return {
    title: product.title ?? "",
    brand: product.brand ?? "",
    model: product.model ?? "",
    sku: product.sku ?? "",
    gtin: product.identifiers?.gtin ?? "",
    ean: product.identifiers?.ean ?? "",
    upc: product.identifiers?.upc ?? "",
    images: (product.images ?? []).join("\n"),
    specs: Object.entries(
      product.specs instanceof Map ? Object.fromEntries(product.specs) : product.specs || {}
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  };
}

export function AdminProductDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { productDetail, action } = useSelector((s) => s.admin);
  const [form, setForm] = useState(null);
  const [mergeSource, setMergeSource] = useState("");
  const [attachInput, setAttachInput] = useState({});
  const fieldErrors = fieldErrorsFrom(action.error);

  const load = () => dispatch(fetchAdminProduct(id));

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatch]);

  useEffect(() => {
    if (productDetail.product && String(productDetail.product._id) === String(id)) {
      setForm(toForm(productDetail.product));
    }
  }, [productDetail.product, id]);

  if (productDetail.status === "loading" && !productDetail.product) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (productDetail.status === "failed") {
    return <ErrorState message={productDetail.error?.message} onRetry={load} />;
  }
  if (!form || !productDetail.product) {
    return <ErrorState message="Product not found" onRetry={load} />;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    const body = {
      title: form.title.trim(),
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      sku: form.sku.trim() || undefined,
      identifiers: {
        gtin: form.gtin.trim() || undefined,
        ean: form.ean.trim() || undefined,
        upc: form.upc.trim() || undefined,
      },
      images: form.images
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      specs: Object.fromEntries(
        form.specs
          .split("\n")
          .map((line) => line.split(":"))
          .filter((parts) => parts.length >= 2 && parts[0].trim())
          .map(([k, ...rest]) => [k.trim(), rest.join(":").trim()])
      ),
    };
    await dispatch(updateAdminProduct({ id, body }));
  }

  async function doMerge(e) {
    e.preventDefault();
    const result = await dispatch(mergeAdminProducts({ sourceId: mergeSource.trim(), targetId: id }));
    if (mergeAdminProducts.fulfilled.match(result)) {
      setMergeSource("");
      load();
    }
  }

  async function doAttach(listingId) {
    const productId = (attachInput[listingId] || "").trim();
    if (!productId) return;
    const result = await dispatch(attachAdminListing({ id: listingId, productId }));
    if (attachAdminListing.fulfilled.match(result)) load();
  }

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-body-sm text-neutral-500">
        <Link to="/admin/products" className="hover:text-primary-600">Products</Link>
        <span aria-hidden="true" className="mx-1">/</span>
        <span className="font-medium text-neutral-900 line-clamp-1">{productDetail.product.title}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-title-2 font-semibold text-neutral-900">Edit product</h2>
        {productDetail.product.archived && <Badge tone="neutral">Archived</Badge>}
        <Link
          to={`/product/${id}`}
          className="text-body-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View public page →
        </Link>
      </div>

      <ActionBanner />

      <AdminCard title="Details">
        <form onSubmit={save} className="space-y-3" aria-label="Edit product details">
          <div>
            <label htmlFor="ep-title" className={labelClass}>
              Title <span className="text-danger-600" aria-hidden="true">*</span>
            </label>
            <input id="ep-title" required minLength={3} value={form.title} onChange={set("title")} className={inputClass} />
            {fieldErrors.title && (
              <p role="alert" className="mt-1 text-caption font-medium text-danger-700">{fieldErrors.title}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="ep-brand" className={labelClass}>Brand</label>
              <input id="ep-brand" value={form.brand} onChange={set("brand")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ep-model" className={labelClass}>Model</label>
              <input id="ep-model" value={form.model} onChange={set("model")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ep-sku" className={labelClass}>SKU</label>
              <input id="ep-sku" value={form.sku} onChange={set("sku")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ep-gtin" className={labelClass}>GTIN</label>
              <input id="ep-gtin" value={form.gtin} onChange={set("gtin")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ep-ean" className={labelClass}>EAN</label>
              <input id="ep-ean" value={form.ean} onChange={set("ean")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ep-upc" className={labelClass}>UPC</label>
              <input id="ep-upc" value={form.upc} onChange={set("upc")} className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="ep-images" className={labelClass}>Image URLs (one per line)</label>
            <textarea id="ep-images" rows={3} value={form.images} onChange={set("images")} className={`${inputClass} h-auto py-2`} />
          </div>
          <div>
            <label htmlFor="ep-specs" className={labelClass}>Specs (Key: Value, one per line)</label>
            <textarea id="ep-specs" rows={3} value={form.specs} onChange={set("specs")} className={`${inputClass} h-auto py-2`} />
          </div>
          <button
            type="submit"
            disabled={action.busy}
            className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {action.busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </AdminCard>

      <AdminCard
        title="Merge another product into this one"
        description="Moves all listings, wishlists, alerts, and notifications from the source product here, then archives the source. Conflicting identifiers are rejected."
      >
        <form onSubmit={doMerge} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="merge-source" className={labelClass}>Source product ID (will be archived)</label>
            <input
              id="merge-source"
              value={mergeSource}
              onChange={(e) => setMergeSource(e.target.value)}
              placeholder="24-char product id"
              className={inputClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={action.busy || !mergeSource.trim()}
            className="mb-0.5 inline-flex min-h-[44px] items-center rounded-md border border-primary-600 bg-white px-4 text-body-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Merge into this
          </button>
        </form>
      </AdminCard>

      <AdminCard title={`Listings (${productDetail.listings.length})`}>
        {productDetail.listings.length === 0 ? (
          <p className="text-body-sm text-neutral-600">
            No listings attached. Use the Listings page to attach one.
          </p>
        ) : (
          <TableWrap caption="Listings for this product">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Store</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">MRP</Th>
                <Th>Availability</Th>
                <Th>Last synced</Th>
                <Th>Move to product…</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {productDetail.listings.map((l) => (
                <tr key={l._id}>
                  <Td className="font-medium">{l.store?.name || "—"}</Td>
                  <Td className="text-right">{formatINR(l.currentPrice)}</Td>
                  <Td className="text-right">{l.mrp ? formatINR(l.mrp) : "—"}</Td>
                  <Td><StatusPill status={l.availability} /></Td>
                  <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(l.lastSyncedAt)}</Td>
                  <Td>
                    {l.store?.active === false && (
                      <span className="mr-2 text-caption text-warning-700">Store disabled</span>
                    )}
                    <div className="flex gap-2">
                      <label htmlFor={`attach-${l._id}`} className="sr-only">New product id</label>
                      <input
                        id={`attach-${l._id}`}
                        value={attachInput[l._id] || ""}
                        onChange={(e) => setAttachInput((s) => ({ ...s, [l._id]: e.target.value }))}
                        placeholder="product id"
                        className={`${inputClass} h-10 w-40`}
                      />
                      <button
                        type="button"
                        onClick={() => doAttach(l._id)}
                        disabled={action.busy}
                        className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                      >
                        Attach
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </AdminCard>
    </div>
  );
}

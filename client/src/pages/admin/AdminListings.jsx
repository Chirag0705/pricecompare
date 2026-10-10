import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminListings,
  fetchAdminStores,
  updateAdminListing,
  attachAdminListing,
  deleteAdminListing,
  clearAdminAction,
} from "../../store/adminSlice";
import { formatINR } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  ActionBanner,
  AdminPagination,
  ConfirmButton,
  StatusPill,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

function EditRow({ listing, onSaved, onCancel, busy }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    currentPrice: String(listing.currentPrice ?? ""),
    mrp: listing.mrp != null ? String(listing.mrp) : "",
    availability: listing.availability || "unknown",
    url: listing.url || "",
    affiliateUrl: listing.affiliateUrl || "",
    etaDays: listing.deliveryInfo?.etaDays != null ? String(listing.deliveryInfo.etaDays) : "",
    freeShipping: Boolean(listing.deliveryInfo?.freeShipping),
    codAvailable: Boolean(listing.deliveryInfo?.codAvailable),
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const body = {
      currentPrice: Number(form.currentPrice),
      availability: form.availability,
      url: form.url.trim(),
    };
    if (form.mrp !== "") body.mrp = Number(form.mrp);
    if (form.affiliateUrl.trim()) body.affiliateUrl = form.affiliateUrl.trim();
    body.deliveryInfo = {
      ...(form.etaDays !== "" ? { etaDays: Number(form.etaDays) } : {}),
      freeShipping: form.freeShipping,
      codAvailable: form.codAvailable,
    };
    const result = await dispatch(updateAdminListing({ id: listing._id, body }));
    if (updateAdminListing.fulfilled.match(result)) onSaved();
  }

  return (
    <tr className="bg-primary-50/40">
      <td colSpan={7} className="px-3 py-4">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`Edit listing ${listing._id}`}>
          <div>
            <label htmlFor={`le-price-${listing._id}`} className={labelClass}>Price (₹)</label>
            <input id={`le-price-${listing._id}`} type="number" min="0" step="0.01" required value={form.currentPrice} onChange={set("currentPrice")} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`le-mrp-${listing._id}`} className={labelClass}>MRP (₹)</label>
            <input id={`le-mrp-${listing._id}`} type="number" min="0" step="0.01" value={form.mrp} onChange={set("mrp")} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`le-avail-${listing._id}`} className={labelClass}>Availability</label>
            <select id={`le-avail-${listing._id}`} value={form.availability} onChange={set("availability")} className={inputClass}>
              <option value="in_stock">In stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label htmlFor={`le-eta-${listing._id}`} className={labelClass}>ETA (days)</label>
            <input id={`le-eta-${listing._id}`} type="number" min="0" value={form.etaDays} onChange={set("etaDays")} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`le-url-${listing._id}`} className={labelClass}>URL</label>
            <input id={`le-url-${listing._id}`} type="url" required value={form.url} onChange={set("url")} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`le-aff-${listing._id}`} className={labelClass}>Affiliate URL (optional)</label>
            <input id={`le-aff-${listing._id}`} type="url" value={form.affiliateUrl} onChange={set("affiliateUrl")} className={inputClass} />
          </div>
          <label className="inline-flex min-h-[44px] items-center gap-2 text-body-sm text-neutral-700">
            <input type="checkbox" checked={form.freeShipping} onChange={set("freeShipping")} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
            Free shipping
          </label>
          <label className="inline-flex min-h-[44px] items-center gap-2 text-body-sm text-neutral-700">
            <input type="checkbox" checked={form.codAvailable} onChange={set("codAvailable")} className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
            COD available
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              {busy ? "Saving…" : "Save listing"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function AdminListings() {
  const dispatch = useDispatch();
  const { listings, stores, action } = useSelector((s) => s.admin);
  const [store, setStore] = useState("");
  const [availability, setAvailability] = useState("");
  const [archived, setArchived] = useState("");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [attachInput, setAttachInput] = useState({});

  const load = (page = 1) =>
    dispatch(
      fetchAdminListings({
        page,
        store: store || undefined,
        availability: availability || undefined,
        archived: archived || undefined,
        q: q || undefined,
      })
    );

  useEffect(() => {
    dispatch(fetchAdminStores());
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message) {
      setEditingId(null);
      load(listings.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Listings</h2>
        <p className="text-body-sm text-neutral-600">{listings.total} total</p>
      </div>

      <ActionBanner />

      <form
        onSubmit={(e) => { e.preventDefault(); load(1); }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="search"
      >
        <div>
          <label htmlFor="li-q" className={labelClass}>Search URL</label>
          <input id="li-q" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="li-store" className={labelClass}>Store</label>
          <select id="li-store" value={store} onChange={(e) => setStore(e.target.value)} className={inputClass}>
            <option value="">All stores</option>
            {stores.items.map((s) => (
              <option key={s._id} value={s._id}>{s.name}{s.active ? "" : " (disabled)"}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="li-avail" className={labelClass}>Availability</label>
          <select id="li-avail" value={availability} onChange={(e) => setAvailability(e.target.value)} className={inputClass}>
            <option value="">Any</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label htmlFor="li-arch" className={labelClass}>Archived</label>
          <select id="li-arch" value={archived} onChange={(e) => setArchived(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="false">Active only</option>
            <option value="true">Archived only</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Apply filters
          </button>
        </div>
      </form>

      {listings.status === "loading" && !listings.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : listings.status === "failed" ? (
        <ErrorState message={listings.error?.message} onRetry={() => load()} />
      ) : listings.items.length === 0 ? (
        <EmptyState title="No listings found" description="Adjust the filters and try again." />
      ) : (
        <>
          <TableWrap caption="Admin listings">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Product</Th>
                <Th>Store</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">MRP</Th>
                <Th>Availability</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {listings.items.map((l) =>
                editingId === l._id ? (
                  <EditRow
                    key={l._id}
                    listing={l}
                    busy={action.busy}
                    onSaved={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={l._id} className="hover:bg-neutral-50">
                    <Td className="max-w-[220px]">
                      {l.product ? (
                        <Link
                          to={`/admin/products/${l.product._id}`}
                          className="line-clamp-2 font-medium text-primary-700 hover:text-primary-800"
                        >
                          {l.product.title}
                        </Link>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                      {l.product?.archived && (
                        <span className="ml-1 text-caption text-neutral-500">(archived product)</span>
                      )}
                    </Td>
                    <Td>
                      {l.store?.name || "—"}
                      {l.store?.active === false && (
                        <span className="ml-1 text-caption text-warning-700">(disabled)</span>
                      )}
                    </Td>
                    <Td className="text-right">{formatINR(l.currentPrice)}</Td>
                    <Td className="text-right">{l.mrp ? formatINR(l.mrp) : "—"}</Td>
                    <Td><StatusPill status={l.availability} /></Td>
                    <Td>{l.archived ? <StatusPill status="archived" /> : <span className="text-caption text-neutral-500">Active</span>}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(l._id)}
                          className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                          Edit
                        </button>
                        <div className="flex gap-1">
                          <label htmlFor={`att-${l._id}`} className="sr-only">Attach to product id</label>
                          <input
                            id={`att-${l._id}`}
                            value={attachInput[l._id] || ""}
                            onChange={(e) => setAttachInput((s) => ({ ...s, [l._id]: e.target.value }))}
                            placeholder="product id"
                            className={`${inputClass} h-10 w-36`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              dispatch(
                                attachAdminListing({ id: l._id, productId: attachInput[l._id]?.trim() })
                              )
                            }
                            disabled={action.busy || !attachInput[l._id]?.trim()}
                            className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                          >
                            Attach
                          </button>
                        </div>
                        <ConfirmButton
                          label={l.archived ? "Archive again" : "Delete"}
                          confirmLabel={l.archived ? "Archive" : "Delete"}
                          description={l.archived ? "Re-archive this already archived listing" : "Delete this listing"}
                          busy={action.busy}
                          onConfirm={async () => {
                            const result = await dispatch(deleteAdminListing(l._id));
                            if (deleteAdminListing.fulfilled.match(result)) load(listings.page);
                          }}
                        />
                      </div>
                    </Td>
                  </tr>
                )
              )}
            </tbody>
          </TableWrap>
          <AdminPagination page={listings.page} totalPages={listings.totalPages} onPage={(p) => load(p)} label="listings" />
        </>
      )}
    </div>
  );
}

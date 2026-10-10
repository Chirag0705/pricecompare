import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminPrices,
  fetchAdminPriceUpdates,
  fetchAdminStores,
  clearAdminAction,
} from "../../store/adminSlice";
import { formatINR, formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AdminPagination,
  StatusPill,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex min-h-[44px] items-center rounded-md px-4 text-body-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
        active
          ? "bg-primary-600 text-white"
          : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminPrices() {
  const dispatch = useDispatch();
  const { prices, priceUpdates, stores } = useSelector((s) => s.admin);
  const [tab, setTab] = useState("current");
  const [sort, setSort] = useState("updated");
  const [store, setStore] = useState("");

  const loadCurrent = (page = 1) =>
    dispatch(fetchAdminPrices({ page, sort, store: store || undefined }));
  const loadUpdates = (page = 1) => dispatch(fetchAdminPriceUpdates({ page }));

  useEffect(() => {
    dispatch(fetchAdminStores());
    loadCurrent();
    loadUpdates();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Price data</h2>
        <p className="text-body-sm text-neutral-600">
          Current listings and the recent price-update audit trail.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Price views">
        <TabButton active={tab === "current"} onClick={() => setTab("current")}>
          Current prices
        </TabButton>
        <TabButton active={tab === "updates"} onClick={() => setTab("updates")}>
          Recent updates
        </TabButton>
      </div>

      {tab === "current" && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); loadCurrent(1); }}
            className="grid gap-3 sm:grid-cols-3"
          >
            <div>
              <label htmlFor="pr-sort" className={labelClass}>Sort by</label>
              <select id="pr-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={inputClass}>
                <option value="updated">Recently updated</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="discount">Biggest discount</option>
              </select>
            </div>
            <div>
              <label htmlFor="pr-store" className={labelClass}>Store</label>
              <select id="pr-store" value={store} onChange={(e) => setStore(e.target.value)} className={inputClass}>
                <option value="">All stores</option>
                {stores.items.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Apply
              </button>
            </div>
          </form>

          {prices.status === "loading" && !prices.items.length ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : prices.status === "failed" ? (
            <ErrorState message={prices.error?.message} onRetry={() => loadCurrent()} />
          ) : prices.items.length === 0 ? (
            <EmptyState title="No listings" description="Ingest or create listings to see prices." />
          ) : (
            <>
              <TableWrap caption="Current prices">
                <thead className="bg-neutral-50">
                  <tr>
                    <Th>Product</Th>
                    <Th>Store</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">MRP</Th>
                    <Th className="text-right">Discount</Th>
                    <Th>Availability</Th>
                    <Th>Flag</Th>
                    <Th>Updated</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {prices.items.map((l) => (
                    <tr key={l._id} className="hover:bg-neutral-50">
                      <Td className="max-w-[220px]">
                        {l.product ? (
                          <Link to={`/admin/products/${l.product._id}`} className="line-clamp-2 font-medium text-primary-700 hover:text-primary-800">
                            {l.product.title}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {l.store?.name || "—"}
                        {l.store?.active === false && (
                          <span className="ml-1 text-caption text-warning-700">(disabled)</span>
                        )}
                      </Td>
                      <Td className="text-right font-medium">{formatINR(l.currentPrice)}</Td>
                      <Td className="text-right">{l.mrp ? formatINR(l.mrp) : "—"}</Td>
                      <Td className="text-right">{l.discountPercent != null ? `${l.discountPercent}%` : "—"}</Td>
                      <Td><StatusPill status={l.availability} /></Td>
                      <Td>
                        {l.anomaly ? <StatusPill status={l.anomaly} /> : <span className="text-neutral-400">—</span>}
                        {l.archived && <span className="ml-1"><StatusPill status="archived" /></span>}
                      </Td>
                      <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(l.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <AdminPagination page={prices.page} totalPages={prices.totalPages} onPage={(p) => loadCurrent(p)} label="prices" />
            </>
          )}
        </>
      )}

      {tab === "updates" && (
        <>
          {priceUpdates.status === "loading" && !priceUpdates.items.length ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : priceUpdates.status === "failed" ? (
            <ErrorState message={priceUpdates.error?.message} onRetry={() => loadUpdates()} />
          ) : priceUpdates.items.length === 0 ? (
            <EmptyState title="No price updates yet" description="Updates appear as syncs record new prices." />
          ) : (
            <>
              <TableWrap caption="Recent price updates">
                <thead className="bg-neutral-50">
                  <tr>
                    <Th>Product</Th>
                    <Th>Store</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">Previous</Th>
                    <Th className="text-right">Delta</Th>
                    <Th>Captured</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {priceUpdates.items.map((u) => (
                    <tr key={u._id} className="hover:bg-neutral-50">
                      <Td className="max-w-[220px]">
                        {u.product ? (
                          <Link to={`/admin/products/${u.product._id}`} className="line-clamp-2 font-medium text-primary-700 hover:text-primary-800">
                            {u.product.title}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{u.listing?.store?.name || "—"}</Td>
                      <Td className="text-right font-medium">{formatINR(u.price)}</Td>
                      <Td className="text-right">{u.previousPrice != null ? formatINR(u.previousPrice) : "—"}</Td>
                      <Td className="text-right">
                        {u.delta == null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              u.delta < 0
                                ? "font-medium text-success-700"
                                : u.delta > 0
                                  ? "font-medium text-danger-700"
                                  : "text-neutral-500"
                            }
                          >
                            {u.delta > 0 ? "+" : ""}
                            {formatINR(u.delta)}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(u.capturedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <AdminPagination
                page={priceUpdates.page}
                totalPages={priceUpdates.totalPages}
                onPage={(p) => loadUpdates(p)}
                label="updates"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

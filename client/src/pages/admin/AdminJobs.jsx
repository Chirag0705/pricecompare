import { Fragment, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminJobs,
  fetchAdminJob,
  fetchAdminAdapters,
  fetchAdminStores,
  triggerAdminSync,
  retryAdminJob,
  clearAdminAction,
} from "../../store/adminSlice";
import { formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
import {
  ActionBanner,
  AdminPagination,
  StatusPill,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

export function AdminJobs() {
  const dispatch = useDispatch();
  const { jobs, jobDetail, adapters, stores, action } = useSelector((s) => s.admin);
  const [status, setStatus] = useState("");
  const [storeSlug, setStoreSlug] = useState("amazon");
  const [terms, setTerms] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const load = (page = 1) =>
    dispatch(fetchAdminJobs({ page, status: status || undefined }));

  useEffect(() => {
    dispatch(fetchAdminAdapters());
    dispatch(fetchAdminStores());
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message) load(jobs.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  async function trigger(e) {
    e.preventDefault();
    const body = { storeSlug };
    const list = terms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) body.searchTerms = list.slice(0, 10);
    const result = await dispatch(triggerAdminSync(body));
    if (triggerAdminSync.fulfilled.match(result)) load(1);
  }

  async function expand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await dispatch(fetchAdminJob(id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Sync jobs</h2>
        <p className="text-body-sm text-neutral-600">
          Trigger manual syncs, inspect runs, and retry failures.
        </p>
      </div>

      <ActionBanner />

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
        <h3 className="text-headline text-neutral-900">Integration adapters</h3>
        {adapters.status === "loading" ? (
          <Skeleton className="mt-2 h-8 rounded-md" />
        ) : adapters.status === "failed" ? (
          <p className="mt-2 text-body-sm text-danger-700">{adapters.error?.message}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {adapters.items.map((a) => (
              <li key={a.slug} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-body-sm">
                {a.name}
                {a.configured ? (
                  <Badge tone="success">Configured</Badge>
                ) : (
                  <Badge tone="warning">Not configured</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={trigger} className="grid gap-3 sm:grid-cols-3" aria-label="Trigger sync">
        <div>
          <label htmlFor="j-store" className={labelClass}>Store</label>
          <select id="j-store" value={storeSlug} onChange={(e) => setStoreSlug(e.target.value)} className={inputClass}>
            {(stores.items.length ? stores.items : [{ slug: "amazon", name: "Amazon" }, { slug: "flipkart", name: "Flipkart" }, { slug: "myntra", name: "Myntra" }]).map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="j-terms" className={labelClass}>Search terms (comma-separated, optional)</label>
          <input
            id="j-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className={inputClass}
            placeholder="wireless earbuds, smart watch"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={action.busy}
            className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {action.busy ? "Triggering…" : "Trigger sync"}
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="j-status" className={labelClass}>Filter status</label>
          <select
            id="j-status"
            value={status}
            onChange={(e) => { setStatus(e.target.value); }}
            className={inputClass}
          >
            <option value="">All</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => load(1)}
            className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Apply filter
          </button>
        </div>
      </div>

      {jobs.status === "loading" && !jobs.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : jobs.status === "failed" ? (
        <ErrorState message={jobs.error?.message} onRetry={() => load()} />
      ) : jobs.items.length === 0 ? (
        <EmptyState title="No sync jobs" description="Trigger a sync above to get started." />
      ) : (
        <>
          <TableWrap caption="Sync jobs">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Store</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="text-right">Fetched</Th>
                <Th className="text-right">Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {jobs.items.map((j) => (
                <Fragment key={j._id}>
                  <tr className="hover:bg-neutral-50">
                    <Td className="font-medium">{j.store?.name || "—"}</Td>
                    <Td>{j.trigger?.type || "—"}</Td>
                    <Td><StatusPill status={j.status} /></Td>
                    <Td className="text-right">
                      {j.stats?.fetched ?? 0} / {j.stats?.created ?? 0} / {j.stats?.updated ?? 0}
                      <span className="ml-1 text-caption text-neutral-500">(f/c/u)</span>
                    </Td>
                    <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(j.createdAt)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => expand(j._id)}
                          aria-expanded={expandedId === j._id}
                          className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                          {expandedId === j._id ? "Hide detail" : "Detail"}
                        </button>
                        {j.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => dispatch(retryAdminJob(j._id))}
                            disabled={action.busy}
                            className="inline-flex min-h-[40px] items-center rounded-md border border-primary-600 bg-white px-3 text-caption font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                  {expandedId === j._id && (
                    <tr key={`${j._id}-detail`}>
                      <td colSpan={6} className="bg-neutral-50 px-3 py-4">
                        {jobDetail.status === "loading" ? (
                          <Skeleton className="h-20 rounded-md" />
                        ) : jobDetail.job ? (
                          <dl className="grid gap-x-6 gap-y-2 text-body-sm sm:grid-cols-2">
                            <div><dt className="font-medium text-neutral-600">Job ID</dt><dd className="font-mono text-caption">{jobDetail.job._id}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Status</dt><dd><StatusPill status={jobDetail.job.status} /></dd></div>
                            <div><dt className="font-medium text-neutral-600">Trigger</dt><dd>{jobDetail.job.trigger?.type || "—"}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Search terms</dt><dd>{jobDetail.job.trigger?.searchTerms?.join(", ") || "—"}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Fetched</dt><dd>{jobDetail.job.stats?.fetched ?? 0}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Created</dt><dd>{jobDetail.job.stats?.created ?? 0}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Updated</dt><dd>{jobDetail.job.stats?.updated ?? 0}</dd></div>
                            <div><dt className="font-medium text-neutral-600">Errors</dt><dd className="text-danger-700">{jobDetail.job.stats?.errors ?? 0}</dd></div>
                            {jobDetail.job.error && (
                              <div className="sm:col-span-2"><dt className="font-medium text-neutral-600">Last error</dt><dd className="text-danger-700">{jobDetail.job.error}</dd></div>
                            )}
                          </dl>
                        ) : (
                          <p className="text-body-sm text-neutral-600">Job detail unavailable.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </TableWrap>
          <AdminPagination page={jobs.page} totalPages={jobs.totalPages} onPage={(p) => load(p)} label="jobs" />
        </>
      )}
    </div>
  );
}

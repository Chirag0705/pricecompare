import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminIssues,
  resolveAdminIssue,
  mergeAdminProducts,
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
  ConfirmButton,
  StatusPill,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

const typeTone = {
  ambiguous_match: "warning",
  invalid_data: "danger",
};

function IssueCard({ issue, onRefresh }) {
  const dispatch = useDispatch();
  const { action } = useSelector((s) => s.admin);
  const [resolution, setResolution] = useState("");

  async function resolveWith(status) {
    const result = await dispatch(
      resolveAdminIssue({
        id: issue._id,
        body: {
          status,
          resolution: resolution.trim() || undefined,
        },
      })
    );
    if (resolveAdminIssue.fulfilled.match(result)) onRefresh();
  }

  async function mergeIntoSuggested() {
    if (!issue.suggested?._id || !issue.product?._id) return;
    const result = await dispatch(
      mergeAdminProducts({
        sourceId: issue.product._id,
        targetId: issue.suggested._id,
      })
    );
    if (mergeAdminProducts.fulfilled.match(result)) {
      await dispatch(
        resolveAdminIssue({
          id: issue._id,
          body: {
            status: "resolved",
            resolution: `Merged into suggested product ${issue.suggested._id}`,
          },
        })
      );
      onRefresh();
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={typeTone[issue.type] || "neutral"}>
          {issue.type?.replace(/_/g, " ")}
        </Badge>
        <StatusPill status={issue.status} />
        <time className="text-caption text-neutral-500" dateTime={issue.createdAt}>
          {formatDateTime(issue.createdAt)}
        </time>
      </div>
      <p className="mt-2 text-body-sm text-neutral-800">{issue.description}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-neutral-500">
        {issue.product && (
          <span>
            Product:{" "}
            <Link to={`/admin/products/${issue.product._id}`} className="font-medium text-primary-700 hover:text-primary-800">
              {issue.product.title}
            </Link>
          </span>
        )}
        {issue.suggested && (
          <span>
            Suggested match:{" "}
            <Link to={`/admin/products/${issue.suggested._id}`} className="font-medium text-primary-700 hover:text-primary-800">
              {issue.suggested.title}
            </Link>
          </span>
        )}
        {issue.store?.name && <span>Store: {issue.store.name}</span>}
      </div>

      {issue.status === "open" && (
        <div className="mt-3 space-y-3">
          {issue.type === "ambiguous_match" && issue.suggested?._id && issue.product?._id && (
            <div className="flex flex-wrap items-center gap-3">
              <ConfirmButton
                label="Merge into suggested"
                confirmLabel="Merge"
                description={`Merge “${issue.product.title}” into “${issue.suggested.title}”`}
                tone="primary"
                busy={action.busy}
                onConfirm={mergeIntoSuggested}
              />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label htmlFor={`res-${issue._id}`} className={labelClass}>Resolution note (optional)</label>
              <input
                id={`res-${issue._id}`}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className={inputClass}
                placeholder="e.g. Reviewed — not the same product"
              />
            </div>
            <button
              type="button"
              onClick={() => resolveWith("resolved")}
              disabled={action.busy}
              className="inline-flex min-h-[44px] items-center rounded-md bg-primary-600 px-4 text-body-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              Mark resolved
            </button>
            <button
              type="button"
              onClick={() => resolveWith("ignored")}
              disabled={action.busy}
              className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              Ignore
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function AdminMatching() {
  const dispatch = useDispatch();
  const { issues, action } = useSelector((s) => s.admin);
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("");

  const load = (page = 1) =>
    dispatch(fetchAdminIssues({ page, status: status || undefined, type: type || undefined }));

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message) load(issues.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Matching review</h2>
        <p className="text-body-sm text-neutral-600">
          Data-quality queue from the ingestion pipeline. Resolve ambiguous matches and invalid listings.
        </p>
      </div>

      <ActionBanner />

      <form
        onSubmit={(e) => { e.preventDefault(); load(1); }}
        className="grid gap-3 sm:grid-cols-3"
      >
        <div>
          <label htmlFor="m-status" className={labelClass}>Status</label>
          <select id="m-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
        <div>
          <label htmlFor="m-type" className={labelClass}>Type</label>
          <select id="m-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <option value="">All types</option>
            <option value="ambiguous_match">Ambiguous match</option>
            <option value="invalid_data">Invalid data</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Apply filters
          </button>
        </div>
      </form>

      {issues.status === "loading" && !issues.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : issues.status === "failed" ? (
        <ErrorState message={issues.error?.message} onRetry={() => load()} />
      ) : issues.items.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description={status === "open" ? "No open data-quality issues." : "No issues match these filters."}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {issues.items.map((issue) => (
              <IssueCard key={issue._id} issue={issue} onRefresh={() => load(issues.page)} />
            ))}
          </ul>
          <AdminPagination page={issues.page} totalPages={issues.totalPages} onPage={(p) => load(p)} label="issues" />
        </>
      )}
    </div>
  );
}

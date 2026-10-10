import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchAdminStats } from "../../store/adminSlice";
import { formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { AdminCard } from "../../components/admin/adminUI";

function StatCard({ label, value, to, hint }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-soft transition-colors hover:border-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500"
    >
      <p className="text-caption font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-title-2 font-semibold text-neutral-900">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-neutral-500">{hint}</p>}
    </Link>
  );
}

export function AdminDashboard() {
  const dispatch = useDispatch();
  const { stats } = useSelector((s) => s.admin);

  useEffect(() => {
    dispatch(fetchAdminStats());
  }, [dispatch]);

  if (stats.status === "loading" && !stats.data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (stats.status === "failed") {
    return <ErrorState message={stats.error?.message} onRetry={() => dispatch(fetchAdminStats())} />;
  }

  const d = stats.data || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Dashboard</h2>
        <p className="mt-1 text-body-sm text-neutral-600">
          System-wide counts and recent activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Products" value={d.products ?? "—"} to="/admin/products" hint={`${d.archivedProducts ?? 0} archived`} />
        <StatCard label="Listings" value={d.listings ?? "—"} to="/admin/listings" />
        <StatCard
          label="Stores"
          value={`${d.storesActive ?? 0}/${d.storesTotal ?? 0}`}
          to="/admin/stores"
          hint="active / total"
        />
        <StatCard label="Users" value={d.usersTotal ?? "—"} to="/admin/users" hint={`${d.usersActive ?? 0} active`} />
        <StatCard label="Open DQ issues" value={d.openIssues ?? "—"} to="/admin/matching" />
        <StatCard
          label="Failed jobs"
          value={d.failedJobs ?? "—"}
          to="/admin/jobs"
          hint={`${d.runningJobs ?? 0} running`}
        />
        <StatCard label="Buy Now clicks" value={d.clicks ?? "—"} to="/admin/activity" />
        <StatCard label="Price updates (7d)" value={d.priceUpdates7d ?? "—"} to="/admin/prices" />
      </div>

      <AdminCard title="Recent activity" description="Latest actions across the system.">
        {!d.recentActivity?.length ? (
          <p className="text-body-sm text-neutral-600">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {d.recentActivity.map((e) => (
              <li key={e._id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-neutral-900">{e.action}</p>
                  <p className="text-caption text-neutral-500">
                    {e.entityType}
                    {e.actor?.name ? ` · ${e.actor.name}` : ""}
                  </p>
                </div>
                <time className="text-caption text-neutral-500" dateTime={e.createdAt}>
                  {formatDateTime(e.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/admin/activity"
          className="mt-3 inline-flex text-body-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View full activity log →
        </Link>
      </AdminCard>
    </div>
  );
}

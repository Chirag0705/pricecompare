import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAdminActivity, clearAdminAction } from "../../store/adminSlice";
import { formatDateTime } from "../../lib/format";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  AdminPagination,
  Th,
  Td,
  TableWrap,
  inputClass,
  labelClass,
} from "../../components/admin/adminUI";

export function AdminActivity() {
  const dispatch = useDispatch();
  const { activity } = useSelector((s) => s.admin);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const load = (page = 1) =>
    dispatch(
      fetchAdminActivity({
        page,
        action: action || undefined,
        entityType: entityType || undefined,
      })
    );

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">System activity</h2>
        <p className="text-body-sm text-neutral-600">
          Audit trail of admin mutations, buy-now clicks, and sync events.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(1); }}
        className="grid gap-3 sm:grid-cols-3"
        role="search"
      >
        <div>
          <label htmlFor="a-action" className={labelClass}>Action</label>
          <input
            id="a-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={inputClass}
            placeholder="e.g. product.create"
          />
        </div>
        <div>
          <label htmlFor="a-entity" className={labelClass}>Entity type</label>
          <input
            id="a-entity"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className={inputClass}
            placeholder="e.g. Product"
          />
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

      {activity.status === "loading" && !activity.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : activity.status === "failed" ? (
        <ErrorState message={activity.error?.message} onRetry={() => load()} />
      ) : activity.items.length === 0 ? (
        <EmptyState title="No activity found" description="Adjust the filters, or perform actions to generate activity." />
      ) : (
        <>
          <TableWrap caption="Activity log">
            <thead className="bg-neutral-50">
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Metadata</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activity.items.map((e) => (
                <tr key={e._id} className="hover:bg-neutral-50">
                  <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(e.createdAt)}</Td>
                  <Td>{e.actor ? `${e.actor.name} (${e.actor.email})` : <span className="text-neutral-400">System / guest</span>}</Td>
                  <Td className="font-mono text-caption font-medium">{e.action}</Td>
                  <Td>
                    {e.entityType}
                    <span className="ml-1 font-mono text-caption text-neutral-400">{String(e.entityId).slice(-8)}</span>
                  </Td>
                  <Td className="max-w-[320px]">
                    <span className="line-clamp-2 font-mono text-caption text-neutral-500">
                      {e.metadata ? JSON.stringify(e.metadata) : "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <AdminPagination page={activity.page} totalPages={activity.totalPages} onPage={(p) => load(p)} label="activity" />
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAdminUsers,
  updateAdminUser,
  clearAdminAction,
} from "../../store/adminSlice";
import { formatDateTime } from "../../lib/format";
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

export function AdminUsers() {
  const dispatch = useDispatch();
  const { users, action } = useSelector((s) => s.admin);
  const { user: currentUser } = useSelector((s) => s.auth);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const load = (page = 1) =>
    dispatch(
      fetchAdminUsers({
        page,
        q: q || undefined,
        role: role || undefined,
        status: status || undefined,
      })
    );

  useEffect(() => {
    load();
    return () => dispatch(clearAdminAction());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (!action.busy && action.message) load(users.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.message, action.busy]);

  const myId = currentUser?.id || currentUser?._id;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title-2 font-semibold text-neutral-900">Users</h2>
        <p className="text-body-sm text-neutral-600">{users.total} total</p>
      </div>

      <ActionBanner />

      <form
        onSubmit={(e) => { e.preventDefault(); load(1); }}
        className="grid gap-3 sm:grid-cols-3"
        role="search"
      >
        <div>
          <label htmlFor="u-q" className={labelClass}>Search name or email</label>
          <input id="u-q" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="u-role" className={labelClass}>Role</label>
          <select id="u-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label htmlFor="u-status" className={labelClass}>Status</label>
          <select id="u-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Apply filters
          </button>
        </div>
      </form>

      {users.status === "loading" && !users.items.length ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : users.status === "failed" ? (
        <ErrorState message={users.error?.message} onRetry={() => load()} />
      ) : users.items.length === 0 ? (
        <EmptyState title="No users found" description="Adjust the filters and try again." />
      ) : (
        <>
          <TableWrap caption="Admin users">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.items.map((u) => {
                const isSelf = String(u._id) === String(myId);
                return (
                  <tr key={u._id} className="hover:bg-neutral-50">
                    <Td className="font-medium">
                      {u.name}
                      {isSelf && <span className="ml-1 text-caption text-neutral-500">(you)</span>}
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>
                      <label htmlFor={`role-${u._id}`} className="sr-only">Role for {u.email}</label>
                      <select
                        id={`role-${u._id}`}
                        value={u.role}
                        disabled={isSelf || action.busy}
                        onChange={(e) =>
                          dispatch(updateAdminUser({ id: u._id, body: { role: e.target.value } }))
                        }
                        className={`${inputClass} h-10 w-28`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </Td>
                    <Td>
                      <StatusPill status={u.active ? "active" : "inactive"} />
                    </Td>
                    <Td className="whitespace-nowrap text-neutral-500">{formatDateTime(u.createdAt)}</Td>
                    <Td>
                      {u.active ? (
                        isSelf ? (
                          <span className="text-caption text-neutral-500">—</span>
                        ) : (
                          <ConfirmButton
                            label="Deactivate"
                            description={`Deactivate ${u.email}`}
                            busy={action.busy}
                            onConfirm={() => dispatch(updateAdminUser({ id: u._id, body: { active: false } }))}
                          />
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => dispatch(updateAdminUser({ id: u._id, body: { active: true } }))}
                          disabled={action.busy}
                          className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                          Reactivate
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <AdminPagination page={users.page} totalPages={users.totalPages} onPage={(p) => load(p)} label="users" />
        </>
      )}
    </div>
  );
}

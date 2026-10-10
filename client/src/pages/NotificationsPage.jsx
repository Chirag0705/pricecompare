import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../store/userSlice";
import { formatDateTime } from "../lib/format";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

export function NotificationsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications } = useSelector((s) => s.user);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  async function handleItemClick(notification) {
    if (!notification.read) dispatch(markNotificationRead(notification.id));
    if (notification.product) navigate(`/product/${notification.product.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title-1 font-semibold text-neutral-900">
            Notifications
          </h1>
          {notifications.status === "succeeded" && (
            <p className="mt-1 text-body-sm text-neutral-600" aria-live="polite">
              {notifications.unreadCount === 0
                ? "You're all caught up."
                : `${notifications.unreadCount} unread`}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={
            notifications.unreadCount === 0 || notifications.status === "loading"
          }
          onClick={() => dispatch(markAllNotificationsRead())}
        >
          Mark all read
        </Button>
      </div>

      <div className="mt-6">
        {notifications.status === "loading" && (
          <div role="status" aria-label="Loading notifications" className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
            <span className="sr-only">Loading notifications…</span>
          </div>
        )}

        {notifications.status === "failed" && (
          <ErrorState
            title="Cannot load notifications"
            message={notifications.error?.message || "The API did not respond."}
            onRetry={() => dispatch(fetchNotifications())}
          />
        )}

        {notifications.status === "succeeded" &&
          (notifications.items.length === 0 ? (
            <EmptyState
              title="No notifications"
              description="When a price alert triggers, the notification appears here."
              actionLabel="Browse products"
              onAction={() => navigate("/search")}
            />
          ) : (
            <ul className="space-y-3" role="list">
              {notifications.items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border ${
                    n.read ? "border-neutral-200 bg-white" : "border-primary-100 bg-primary-50/50"
                  } p-5`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!n.read && <Badge tone="primary">Unread</Badge>}
                        <span className="text-caption text-neutral-500">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-body text-neutral-900">{n.message}</p>
                      {n.product && (
                        <button
                          type="button"
                          onClick={() => handleItemClick(n)}
                          className="mt-2 inline-flex min-h-[44px] items-center text-body-sm font-medium text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                        >
                          View {n.product.title}
                          <span aria-hidden="true" className="ml-1">→</span>
                        </button>
                      )}
                    </div>
                    {!n.read && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => dispatch(markNotificationRead(n.id))}
                        aria-label={`Mark notification "${n.message.slice(0, 40)}…" as read`}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>

      <p className="mt-8 text-center text-caption text-neutral-500">
        <Link to="/alerts" className="hover:text-primary-600 hover:underline">
          Manage price alerts
        </Link>
      </p>
    </div>
  );
}

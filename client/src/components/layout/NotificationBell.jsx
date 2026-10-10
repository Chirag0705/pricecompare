import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../store/userSlice";
import { formatDateTime } from "../../lib/format";

export function NotificationBell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((s) => s.auth);
  const { notifications } = useSelector((s) => s.user);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  // Unread count: fetch on mount + poll every 60s + refresh on tab focus.
  useEffect(() => {
    if (!token) {
      setOpen(false);
      return undefined;
    }
    dispatch(fetchUnreadCount());
    const interval = setInterval(() => dispatch(fetchUnreadCount()), 60000);
    const onFocus = () => dispatch(fetchUnreadCount());
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [dispatch, token]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!token) return null;

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) dispatch(fetchNotifications());
  }

  function handleItemClick(notification) {
    setOpen(false);
    if (!notification.read) dispatch(markNotificationRead(notification.id));
    if (notification.product) navigate(`/product/${notification.product.id}`);
    else navigate("/notifications");
  }

  const count = notifications.unreadCount;
  const badgeLabel = count > 9 ? "9+" : String(count);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={
          count > 0
            ? `Notifications, ${count} unread`
            : "Notifications, none unread"
        }
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {count > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <h2 className="text-body-sm font-semibold text-neutral-900">
              Notifications
            </h2>
            {count > 0 && (
              <button
                type="button"
                onClick={() => dispatch(markAllNotificationsRead())}
                className="text-caption font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.status === "loading" && (
              <div role="status" aria-label="Loading notifications" className="space-y-3 p-4">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <span className="sr-only">Loading notifications…</span>
              </div>
            )}

            {notifications.status === "failed" && (
              <p className="p-4 text-body-sm text-danger-700" role="alert">
                {notifications.error?.message || "Could not load notifications."}
              </p>
            )}

            {notifications.status === "succeeded" &&
              notifications.items.length === 0 && (
                <p className="p-6 text-center text-body-sm text-neutral-600">
                  No notifications yet. Price-drop alerts appear here.
                </p>
              )}

            {notifications.status === "succeeded" &&
              notifications.items.slice(0, 5).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleItemClick(n)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 ${
                    n.read ? "" : "bg-primary-50/60"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                    )}
                    <span className="text-body-sm text-neutral-900">{n.message}</span>
                  </span>
                  <span className="ml-4 text-caption text-neutral-500">
                    {n.read ? "" : "Unread · "}
                    {formatDateTime(n.createdAt)}
                  </span>
                </button>
              ))}
          </div>

          <div className="border-t border-neutral-200 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
              className="w-full rounded-md px-3 py-2.5 text-left text-body-sm font-medium text-primary-600 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

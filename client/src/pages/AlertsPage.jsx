import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAlerts,
  patchAlert,
  deleteAlert,
} from "../store/userSlice";
import { formatINR, formatDate } from "../lib/format";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

function statusOf(alert) {
  if (!alert.active) return { label: "Paused", tone: "warning" };
  if (alert.targetMet) return { label: "Target met", tone: "success" };
  return { label: "Active", tone: "primary" };
}

function AlertRow({ alert, busy, onToggle, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const status = statusOf(alert);

  return (
    <div className="flex flex-col gap-4 border-b border-neutral-200 p-5 last:border-0 sm:flex-row sm:items-center">
      <Link
        to={`/product/${alert.product?.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-50">
          {alert.product?.image ? (
            <img src={alert.product.image} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
              <svg className="h-8 w-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-body font-medium text-neutral-900">
            {alert.product?.title || "Product unavailable"}
          </p>
          <p className="mt-0.5 text-caption text-neutral-500">
            Created {formatDate(alert.createdAt)}
            {alert.lastTriggeredAt
              ? ` · Last triggered ${formatDate(alert.lastTriggeredAt)}`
              : ""}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:justify-end">
        <div className="text-left sm:text-right">
          <p className="text-caption text-neutral-500">Target</p>
          <p className="text-body font-semibold text-neutral-900">
            {formatINR(alert.targetPrice)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-caption text-neutral-500">Current</p>
          <p className="text-body font-semibold text-neutral-900">
            {alert.currentPrice !== null ? formatINR(alert.currentPrice) : "—"}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => onToggle(alert)}
          aria-label={
            alert.active
              ? `Pause alert for ${alert.product?.title || "product"}`
              : `Resume alert for ${alert.product?.title || "product"}`
          }
        >
          {busy ? "…" : alert.active ? "Pause" : "Resume"}
        </Button>

        {confirming ? (
          <div
            role="alertdialog"
            aria-label="Confirm delete alert"
            className="flex items-center gap-2"
          >
            <span className="text-caption text-neutral-700">Delete?</span>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => onDelete(alert)}
            >
              {busy ? "…" : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            aria-label={`Delete alert for ${alert.product?.title || "product"}`}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

export function AlertsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { alerts } = useSelector((s) => s.user);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    dispatch(fetchAlerts());
  }, [dispatch]);

  async function handleToggle(alert) {
    setBusyId(alert.id);
    setActionError(null);
    const result = await dispatch(
      patchAlert({ id: alert.id, active: !alert.active })
    );
    setBusyId(null);
    if (result.error) {
      setActionError(result.payload?.message || "Could not update alert.");
    }
  }

  async function handleDelete(alert) {
    setBusyId(alert.id);
    setActionError(null);
    const result = await dispatch(deleteAlert(alert.id));
    setBusyId(null);
    if (result.error) {
      setActionError(result.payload?.message || "Could not delete alert.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-title-1 font-semibold text-neutral-900">Price alerts</h1>
      <p className="mt-1 text-body-sm text-neutral-600">
        We notify you in-app when a product&apos;s best price reaches your target.
      </p>

      {actionError && (
        <p className="mt-4 rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-body-sm text-danger-700" role="alert">
          {actionError}
        </p>
      )}

      <div className="mt-6">
        {alerts.status === "loading" && (
          <div role="status" aria-label="Loading alerts" className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-neutral-200 p-5">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
            <span className="sr-only">Loading alerts…</span>
          </div>
        )}

        {alerts.status === "failed" && (
          <ErrorState
            title="Cannot load alerts"
            message={alerts.error?.message || "The API did not respond."}
            onRetry={() => dispatch(fetchAlerts())}
          />
        )}

        {alerts.status === "succeeded" &&
          (alerts.items.length === 0 ? (
            <EmptyState
              title="No price alerts yet"
              description="Open any product and choose “Set price alert” to get notified when the price drops to your target."
              actionLabel="Browse products"
              onAction={() => navigate("/search")}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {alerts.items.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  busy={busyId === alert.id}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

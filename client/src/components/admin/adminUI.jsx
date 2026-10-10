import { useState } from "react";
import { useSelector } from "react-redux";
import { Badge } from "../ui/Badge";

export function AdminCard({ title, description, children, className = "" }) {
  return (
    <section
      className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-soft sm:p-6 ${className}`}
    >
      {title && (
        <h2 className="text-headline text-neutral-900">{title}</h2>
      )}
      {description && (
        <p className="mt-1 text-body-sm text-neutral-600">{description}</p>
      )}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function ActionBanner() {
  const { action } = useSelector((s) => s.admin);
  if (action.busy) {
    return (
      <p role="status" className="mb-4 flex items-center gap-2 text-body-sm text-neutral-600">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500" aria-hidden="true" />
        Working…
      </p>
    );
  }
  if (action.error) {
    return (
      <p
        role="alert"
        className="mb-4 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-body-sm font-medium text-danger-700"
      >
        {action.error.message}
      </p>
    );
  }
  if (action.message) {
    return (
      <p
        role="status"
        className="mb-4 rounded-md border border-success-200 bg-success-50 px-3 py-2 text-body-sm font-medium text-success-700"
      >
        {action.message}
      </p>
    );
  }
  return null;
}

export function AdminPagination({ page, totalPages, onPage, label = "pages" }) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={`${label} pagination`}
      className="mt-4 flex items-center justify-between gap-4"
    >
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        ← Previous
      </button>
      <span className="text-body-sm text-neutral-600" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex min-h-[44px] items-center rounded-md border border-neutral-300 bg-white px-4 text-body-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        Next →
      </button>
    </nav>
  );
}

export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  busy = false,
  tone = "danger",
  className = "",
  description,
}) {
  const [confirming, setConfirming] = useState(false);
  const toneClass =
    tone === "danger"
      ? "border-danger-300 text-danger-700 hover:bg-danger-50"
      : "border-neutral-300 text-neutral-900 hover:bg-neutral-100";

  if (confirming) {
    return (
      <div
        role="alertdialog"
        aria-label={description || label}
        className={`inline-flex flex-wrap items-center gap-2 ${className}`}
      >
        <span className="text-body-sm text-neutral-700">{description || label}?</span>
        <button
          type="button"
          onClick={async () => {
            await onConfirm();
            setConfirming(false);
          }}
          disabled={busy}
          className={`inline-flex min-h-[40px] items-center rounded-md border px-3 text-caption font-semibold transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${toneClass}`}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center rounded-md border border-neutral-300 bg-white px-3 text-caption font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={busy}
      className={`inline-flex min-h-[40px] items-center rounded-md border bg-white px-3 text-caption font-medium transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${toneClass} ${className}`}
    >
      {label}
    </button>
  );
}

export function StatusPill({ status }) {
  const map = {
    in_stock: { tone: "success", label: "In stock" },
    out_of_stock: { tone: "warning", label: "Out of stock" },
    preorder: { tone: "primary", label: "Preorder" },
    unavailable: { tone: "neutral", label: "Unavailable" },
    unknown: { tone: "neutral", label: "Unknown" },
    active: { tone: "success", label: "Active" },
    inactive: { tone: "neutral", label: "Inactive" },
    running: { tone: "primary", label: "Running" },
    succeeded: { tone: "success", label: "Succeeded" },
    failed: { tone: "danger", label: "Failed" },
    pending: { tone: "warning", label: "Pending" },
    open: { tone: "warning", label: "Open" },
    resolved: { tone: "success", label: "Resolved" },
    ignored: { tone: "neutral", label: "Ignored" },
    archived: { tone: "neutral", label: "Archived" },
    admin: { tone: "primary", label: "Admin" },
    user: { tone: "neutral", label: "User" },
    deep_discount: { tone: "danger", label: "Deep discount" },
  };
  const m = map[status] ?? { tone: "neutral", label: String(status) };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export const inputClass =
  "h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-body-sm text-neutral-900 placeholder:text-neutral-400 transition-colors hover:border-neutral-400 focus:border-primary-500 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,113,227,0.45)]";

export const labelClass = "mb-1.5 block text-body-sm font-medium text-neutral-800";

export function Th({ children, className = "" }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-wide text-neutral-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 text-body-sm text-neutral-800 ${className}`}>{children}</td>;
}

export function TableWrap({ children, caption }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 bg-white">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

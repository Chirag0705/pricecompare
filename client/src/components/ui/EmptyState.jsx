import { Button } from "./Button";

export function EmptyState({
  title = "Nothing here yet",
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <svg
        className="mb-4 h-10 w-10 text-neutral-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-3.5l-2 3h-5l-2-3H4"
        />
      </svg>
      <h3 className="text-title-3 text-neutral-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-body-sm text-neutral-600">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

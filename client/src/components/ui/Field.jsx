import { useId, useState } from "react";

export function Field({
  label,
  error,
  hint,
  type = "text",
  required = false,
  autoComplete,
  className = "",
  id: idProp,
  ...inputProps
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const actualType = isPassword && revealed ? "text" : type;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-body-sm font-medium text-neutral-800"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          type={actualType}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={`h-12 w-full rounded-md border bg-white px-3.5 text-body-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,113,227,0.45)] ${
            error
              ? "border-danger-500"
              : "border-neutral-300 hover:border-neutral-400 focus:border-primary-500"
          } ${isPassword ? "pr-12" : ""}`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-2 text-caption font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 min-h-[40px] min-w-[40px]"
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-caption text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 flex items-center gap-1 text-caption font-medium text-danger-700"
        >
          <svg
            className="h-3.5 w-3.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const variants = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-soft",
  secondary:
    "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-100 active:bg-neutral-200",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700",
};

const sizes = {
  sm: "h-9 px-3 text-body-sm",
  md: "h-11 px-4 text-body-sm",
  lg: "h-12 px-6 text-body",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 min-h-[44px] min-w-[44px] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

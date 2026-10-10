export function Spinner({ size = "md", label = "Loading" }) {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };
  return (
    <span role="status" aria-label={label} className="inline-flex items-center">
      <span
        className={`${sizes[size]} animate-spin rounded-full border-[3px] border-neutral-300 border-t-primary-500`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

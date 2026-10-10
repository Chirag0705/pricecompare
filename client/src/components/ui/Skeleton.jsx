export function Skeleton({ className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      aria-hidden="true"
      role="presentation"
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? "h-4 w-3/5" : "h-4 w-full"}
        />
      ))}
    </div>
  );
}

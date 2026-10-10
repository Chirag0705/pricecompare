export function Card({ children, className = "", as: Tag = "div", ...props }) {
  return (
    <Tag
      className={`rounded-lg border border-neutral-200 bg-white shadow-soft ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-caption text-neutral-500">
          © {new Date().getFullYear()} PriceCompare. Compare prices across
          Amazon, Flipkart, and Myntra.
        </p>
      </div>
    </footer>
  );
}

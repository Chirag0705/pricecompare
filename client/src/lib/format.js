const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return inrFormatter.format(amount);
}

export const availabilityMeta = {
  in_stock: { label: "In stock", tone: "success" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  unknown: { label: "Availability unknown", tone: "neutral" },
};

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

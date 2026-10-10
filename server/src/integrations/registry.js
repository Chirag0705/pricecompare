import { amazonAdapter } from "./adapters/amazon.js";
import { flipkartAdapter } from "./adapters/flipkart.js";
import { myntraAdapter } from "./adapters/myntra.js";
import { assertAdapter } from "./contract.js";

const adapters = [amazonAdapter, flipkartAdapter, myntraAdapter];
for (const a of adapters) assertAdapter(a);

const bySlug = new Map(adapters.map((a) => [a.slug, a]));

export function getAdapter(slug) {
  return bySlug.get(slug) || null;
}

export function allAdapters() {
  return adapters;
}

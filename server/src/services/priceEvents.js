import { EventEmitter } from "node:events";

/**
 * Price-change event hook. Phase 3 emits; Phase 5 (price alerts)
 * subscribes. Payload: { productId, listingId, storeId, oldPrice, newPrice, mrp }
 */
export const priceEvents = new EventEmitter();
priceEvents.setMaxListeners(50);

export function emitPriceChanged(detail) {
  priceEvents.emit("priceChanged", detail);
}

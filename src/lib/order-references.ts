type Order = Record<string, unknown>;

/** Assign missing references without changing existing numbers or order details. */
export function assignOrderReferences(doc: Record<string, string>): boolean {
  let changed = false;
  const used = new Set<string>();
  const legacy = (order: Order) => String(order.ref || String(order.note || "").match(/🛒 Order #([A-Z0-9]+)\b/i)?.[1] || "");
  const parse = (key: string): Order[] => {
    const value = JSON.parse(doc[key] || "[]");
    if (!Array.isArray(value)) throw new Error("Invalid orders storage");
    return value;
  };
  const orders = parse("hax-orders");
  const pending = parse("hax-orders-pending");
  for (const order of [...orders, ...pending]) if (legacy(order)) used.add(legacy(order));
  const newRef = () => {
    let ref: string;
    do { ref = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(); } while (used.has(ref));
    used.add(ref);
    return ref;
  };
  for (const order of orders) {
    if (!order.ref) { order.ref = legacy(order) || newRef(); changed = true; }
  }
  let pendingChanged = false;
  for (const entry of pending) {
    if (!entry.ref) { entry.ref = newRef(); pendingChanged = true; }
    if (Array.isArray(entry.orders)) for (const order of entry.orders as Order[]) {
      if (!order.ref) { order.ref = legacy(order) || entry.ref; pendingChanged = true; }
    }
  }
  if (changed) doc["hax-orders"] = JSON.stringify(orders);
  if (pendingChanged) doc["hax-orders-pending"] = JSON.stringify(pending);
  return changed || pendingChanged;
}

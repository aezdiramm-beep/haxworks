export async function paymentTokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Customer acknowledgement only. Never change paid amounts or production status. */
export function reportOrderPayment(doc: Record<string, string>, ref: string, tokenHash: string) {
  const pending = JSON.parse(doc["hax-orders-pending"] || "[]") as Record<string, unknown>[];
  const orders = JSON.parse(doc["hax-orders"] || "[]") as Record<string, unknown>[];
  const entry = pending.find((item) => item.ref === ref && item.paymentTokenHash === tokenHash);
  const active = orders.filter((item) => item.ref === ref && item.paymentTokenHash === tokenHash);
  if (!entry && !active.length) return { found: false, changed: false };
  const reportedAt = new Date().toISOString();
  let changed = false;
  const mark = (order: Record<string, unknown>) => {
    if (order.paymentReportedAt) return;
    order.paymentReportedAt = reportedAt;
    if (typeof order.note === "string") order.note += " · Customer reports down payment sent — verify transfer";
    changed = true;
  };
  if (entry) {
    mark(entry);
    if (Array.isArray(entry.orders)) entry.orders.forEach(mark);
  }
  active.forEach(mark);
  if (changed) {
    if (entry) doc["hax-orders-pending"] = JSON.stringify(pending);
    if (active.length) doc["hax-orders"] = JSON.stringify(orders);
  }
  return { found: true, changed };
}

/** Keep a customer report when an older open Orders tab saves or confirms a lead. */
export function preservePaymentState(incoming: Record<string, string>, current: Record<string, string>) {
  const parse = (doc: Record<string, string>, key: string) => JSON.parse(doc[key] || "[]") as Record<string, unknown>[];
  const pending = parse(current, "hax-orders-pending");
  const stored = new Map([...parse(current, "hax-orders"), ...pending, ...pending.flatMap((entry) => Array.isArray(entry.orders) ? entry.orders : [])]
    .map((entry) => [entry.id, entry]));
  const keep = (entry: Record<string, unknown>) => {
    const previous = stored.get(entry.id);
    if (!previous) return;
    for (const key of ["paymentTokenHash", "paymentReportedAt"]) if (previous[key]) entry[key] = previous[key];
    if (previous.paymentReportedAt && typeof entry.note === "string" && !entry.note.includes("Customer reports down payment sent")) entry.note += " · Customer reports down payment sent — verify transfer";
  };
  for (const key of ["hax-orders", "hax-orders-pending"]) {
    if (!incoming[key]) continue;
    const entries = parse(incoming, key);
    for (const entry of entries) {
      keep(entry);
      if (Array.isArray(entry.orders)) entry.orders.forEach(keep);
    }
    incoming[key] = JSON.stringify(entries);
  }
}

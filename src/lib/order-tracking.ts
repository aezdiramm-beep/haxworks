type Row = Record<string, unknown>;
const rows = (value: string | undefined): Row[] => {
  const parsed = JSON.parse(value || "[]");
  if (!Array.isArray(parsed)) throw new Error("Invalid order storage");
  return parsed.filter((item) => item && typeof item === "object");
};

export function normalizeOrderRef(value: unknown): string {
  return String(value ?? "").trim().replace(/^(?:ORDER\s*)?#\s*/i, "").toUpperCase();
}

function reference(order: Row) {
  return normalizeOrderRef(order.ref || String(order.note || "").match(/🛒 Order #([A-Z0-9]+)\b/i)?.[1] || "");
}

const stages: Record<string, string> = {
  Pending: "Designing", Printing: "Printing", "Ready for Ship-out": "Preparing for painting",
  Shipped: "On the way to our painter", Received: "Received by our painter",
  "Ready for Painting": "Ready for painting", Painting: "Painting",
  Shipping: "Shipping to you", Completed: "Completed", "On Hold": "On hold", Cancelled: "Cancelled",
};

/** Public projection only: never return names, notes, contact or payment details. */
export function trackOrder(doc: Record<string, string>, ref: string) {
  const active = rows(doc["hax-orders"]).filter((order) => reference(order) === ref);
  const pending = rows(doc["hax-orders-pending"]).filter((order) => normalizeOrderRef(order.ref) === ref);
  // Old five-digit references can collide. Never combine two customers' orders.
  if (pending.length > 1 || (pending.length && active.length) || new Set(active.map((order) => order.name)).size > 1) return null;
  if (active.length) {
    const figures = active.flatMap((order) => {
      const existing = Array.isArray(order.figures) ? order.figures as Row[] : [];
      const qty = Math.min(100, Math.max(1, Number(order.qty) || 1));
      const terminal = String(order.status || "").trim().toLowerCase();
      return Array.from({ length: qty }, (_, index) => {
        let stage = String(existing[index]?.stage || "Pending");
        if (["cancelled", "canceled"].includes(terminal)) stage = "Cancelled";
        else if (!existing[index]?.stage && ["completed", "done", "shipped"].includes(terminal)) stage = "Completed";
        return { status: stages[stage] || "In progress" };
      });
    });
    const all = (status: string) => figures.every((figure) => figure.status === status);
    const status = all("Completed") ? "Completed" : all("Cancelled") ? "Cancelled"
      : all("Designing") ? "Designing" : all(figures[0].status) ? figures[0].status : "In progress";
    return { ref, status, figures, ...(active.some((order) => order.paymentReportedAt) ? { paymentReported: true } : {}) };
  }
  if (pending.length) return { ref, status: "Awaiting confirmation", figures: [], ...(pending[0].paymentReportedAt ? { paymentReported: true } : {}) };
  return null;
}

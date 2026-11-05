import { test } from "node:test";
import assert from "node:assert/strict";
import { assignOrderReferences } from "./order-references.ts";
import { trackOrder } from "./order-tracking.ts";

test("backfills every status, preserves details and stays unchanged on repeat", () => {
  const originals = ["Pending", "Completed", "Cancelled", "Refunded"].map((status, i) => ({ id: String(i), name: `Lead ${i}`, status, note: "Box color: Plum · Name on box: KAI", paid: 100, figures: [{ stage: status === "Completed" ? "Completed" : "Pending" }] }));
  const doc = { "hax-orders": JSON.stringify(originals) };
  assert.equal(assignOrderReferences(doc), true);
  const saved = JSON.parse(doc["hax-orders"]);
  assert.equal(new Set(saved.map((o: { ref: string }) => o.ref)).size, originals.length);
  saved.forEach((order: { ref: string }, i: number) => {
    assert.match(order.ref, /^[A-F0-9]{12}$/);
    const { ref, ...rest } = order;
    assert.deepEqual(rest, originals[i]);
    assert.ok(trackOrder(doc, ref));
  });
  const first = doc["hax-orders"];
  assert.equal(assignOrderReferences(doc), false);
  assert.equal(doc["hax-orders"], first);
});

test("keeps assigned numbers and shared legacy checkout numbers", () => {
  const doc = { "hax-orders": JSON.stringify([{ ref: "ABCDEF123456" }, { note: "🛒 Order #12345 (figure 1 of 2)" }, { note: "🛒 Order #12345 (figure 2 of 2)" }]) };
  assignOrderReferences(doc);
  assert.deepEqual(JSON.parse(doc["hax-orders"]).map((o: { ref: string }) => o.ref), ["ABCDEF123456", "12345", "12345"]);
});

test("pending figure lines inherit the customer's existing order number", () => {
  const doc = { "hax-orders-pending": JSON.stringify([{ ref: "54321", orders: [{ id: "one" }, { id: "two" }] }]) };
  assert.equal(assignOrderReferences(doc), true);
  const [pending] = JSON.parse(doc["hax-orders-pending"]);
  assert.equal(pending.ref, "54321");
  assert.deepEqual(pending.orders.map((o: { ref: string }) => o.ref), ["54321", "54321"]);
  assert.equal(assignOrderReferences(doc), false);
});

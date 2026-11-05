import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCheckout } from "./order-checkout.ts";
import { paymentTokenHash, reportOrderPayment, preservePaymentState } from "./order-payment.ts";
import { trackOrder } from "./order-tracking.ts";

const item = { size: 'Standard 4"', color: "Plum", boxName: "MARCO", qty: 1 };
test("fees are charged once per order and half is calculated to cents", () => {
  const out = calculateCheckout({ items: [item, item], accessoryFee: "200.50", rushFee: "100" });
  assert.equal(out.total, 3498.50);
  assert.equal(out.payNow, 1749.25);
  assert.equal(calculateCheckout({ items: [item], accessoryFee: "0", rushFee: 0 }).payNow, 799.50);
});
test("both fee fields require explicit zero; invalid fees cannot proceed", () => {
  for (const bad of [undefined, null, "", " ", -1, "abc", Infinity, "1.001", 100001, false, []]) {
    assert.throws(() => calculateCheckout({ items: [item], accessoryFee: bad, rushFee: 0 }));
    assert.throws(() => calculateCheckout({ items: [item], accessoryFee: 0, rushFee: bad }));
  }
});
test("server recalculates prices, limits lines and rejects quantities", () => {
  const out = calculateCheckout({ items: [{ ...item, price: 1 }], accessoryFee: 0, rushFee: 0, total: 1, customAmount: 1 });
  assert.equal(out.total, 1599);
  assert.throws(() => calculateCheckout({ items: [{ ...item, qty: 2 }], accessoryFee: 0, rushFee: 0 }));
  assert.throws(() => calculateCheckout({ items: Array(9).fill(item), accessoryFee: 0, rushFee: 0 }));
  assert.throws(() => calculateCheckout({ items: [{ ...item, size: "__proto__" }], accessoryFee: 0, rushFee: 0 }));
});
test("custom color fee remains included per figure", () => {
  const out = calculateCheckout({ items: [{ ...item, color: "Custom - Build it with us" }, item], accessoryFee: 0, rushFee: 0 });
  assert.equal(out.total, 3298);
  assert.equal(out.items[0].price, 1699);
});
test("payment acknowledgement requires the private token and never settles an order", async () => {
  const hash = await paymentTokenHash("checkout-only-token");
  const order = { ref: "ABCDEF123456", paymentTokenHash: hash, paid: 0, balance: 1599, status: "Pending", note: "Box color: Plum" };
  const doc = { "hax-orders-pending": JSON.stringify([{ ...order, orders: [order] }]), "hax-orders": "[]" };
  const initial = JSON.stringify(doc);
  assert.deepEqual(reportOrderPayment(doc, order.ref, "wrong"), { found: false, changed: false });
  assert.equal(JSON.stringify(doc), initial);
  assert.deepEqual(reportOrderPayment(doc, order.ref, hash), { found: true, changed: true });
  const pending = JSON.parse(doc["hax-orders-pending"])[0];
  assert.equal(pending.orders[0].paid, 0);
  assert.equal(pending.orders[0].balance, 1599);
  assert.equal(pending.orders[0].status, "Pending");
  assert.ok(pending.paymentReportedAt);
  assert.match(pending.orders[0].note, /verify transfer/);
  const first = JSON.stringify(doc);
  assert.deepEqual(reportOrderPayment(doc, order.ref, hash), { found: true, changed: false });
  assert.equal(JSON.stringify(doc), first);
  assert.equal(trackOrder(doc, order.ref)?.paymentReported, true);
  assert.ok(!JSON.stringify(trackOrder(doc, order.ref)).includes(hash));
});
test("reporting still works after the shop confirms the order", async () => {
  const hash = await paymentTokenHash("another-token");
  const doc = { "hax-orders": JSON.stringify([{ ref: "ABCDEF123456", paymentTokenHash: hash, status: "Pending", paid: 0 }]) };
  assert.equal(reportOrderPayment(doc, "ABCDEF123456", hash).found, true);
  assert.equal(trackOrder(doc, "ABCDEF123456")?.paymentReported, true);
  assert.equal(JSON.parse(doc["hax-orders"])[0].paid, 0);
});

test("older Orders tabs cannot erase reports when confirming or editing a lead", () => {
  const original = { id: "figure-1", ref: "ABCDEF123456", note: "Box color: Plum", paymentTokenHash: "hash", paymentReportedAt: "2026-11-05T00:00:00Z", paid: 0, balance: 1599 };
  const current = { "hax-orders-pending": JSON.stringify([{ id: "pending-1", orders: [original] }]) };
  const incoming = { "hax-orders": JSON.stringify([{ id: "figure-1", ref: original.ref, note: "Updated by shop", paid: 0, balance: 1599 }]) };
  preservePaymentState(incoming, current);
  const [saved] = JSON.parse(incoming["hax-orders"]);
  assert.equal(saved.paymentTokenHash, "hash");
  assert.equal(saved.paymentReportedAt, original.paymentReportedAt);
  assert.match(saved.note, /Updated by shop/);
  assert.match(saved.note, /verify transfer/);
  assert.equal(saved.paid, 0);
});

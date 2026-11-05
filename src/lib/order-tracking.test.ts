import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrderRef, trackOrder } from "./order-tracking.ts";

const doc = (orders: unknown[] = [], pending: unknown[] = []) => ({
  "hax-orders": JSON.stringify(orders), "hax-orders-pending": JSON.stringify(pending),
});

test("tracks pending submissions without exposing their details", () => {
  assert.deepEqual(trackOrder(doc([], [{ ref: "12345", name: "Private", contact: "Secret" }]), "12345"),
    { ref: "12345", status: "Awaiting confirmation", figures: [] });
});

test("finds legacy note references and tracks each figure without exposing notes", () => {
  const result = trackOrder(doc([{ name: "Private", note: "🛒 Order #12345 · Contact: Secret", qty: 2,
    figures: [{ stage: "Printing" }, { stage: "Shipped" }] }]), "12345");
  assert.deepEqual(result, { ref: "12345", status: "In progress", figures: [{ status: "Printing" }, { status: "On the way to our painter" }] });
});

test("tracking survives note edits using the structured order reference", () => {
  assert.equal(trackOrder(doc([{ ref: "ABCDEF123456", qty: 1, note: "Changed", figures: [{ stage: "Painting" }] }]), "ABCDEF123456")?.status, "Painting");
});

test("multi-line completion, cancellation and unknown numbers", () => {
  assert.equal(trackOrder(doc([{ ref: "12345", name: "One", figures: [{ stage: "Completed" }] },
    { ref: "12345", name: "One", figures: [{ stage: "Completed" }] }]), "12345")?.status, "Completed");
  assert.equal(trackOrder(doc([{ ref: "12345", status: "Cancelled" }]), "12345")?.status, "Cancelled");
  assert.equal(trackOrder(doc(), "12345"), null);
});

test("ambiguous old references are not combined", () => {
  assert.equal(trackOrder(doc([{ ref: "12345", name: "One" }, { ref: "12345", name: "Two" }]), "12345"), null);
  assert.equal(trackOrder(doc([], [{ ref: "12345" }, { ref: "12345" }]), "12345"), null);
});

test("accepts a copied order label and mixed-case new references", () => {
  assert.equal(normalizeOrderRef(" ORDER #abcdef123456 "), "ABCDEF123456");
  assert.equal(normalizeOrderRef("#12345"), "12345");
});

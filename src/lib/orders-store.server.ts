/**
 * Shared server helpers for the orders doc (D1 `app_state`, key 'orders').
 * The doc mirrors the /orders page's localStorage: every value is a STRING
 * (e.g. data["hax-orders"] is a JSON-encoded array), exactly like localDoc().
 * Used by /api/orders (web page) and the native app endpoints.
 */
type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
    };
  };
};

export const COOKIE = "hax_orders";

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

export const password = () => process.env.ORDERS_PASSWORD?.trim() || "HW123";

export async function token(): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("haxworks-orders-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Cookie (web page) or `Authorization: Bearer <token>` (native app). */
export async function authed(request: Request) {
  const expected = await token();
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    if (same(auth.slice(7).trim(), expected)) return true;
  }
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  return Boolean(match) && same(match!.slice(COOKIE.length + 1), expected);
}

export async function db(): Promise<D1> {
  const { env } = (await import("cloudflare:workers")) as unknown as { env: { DB?: D1 } };
  if (!env.DB) throw new Error("D1 binding `DB` is missing");
  await env.DB.prepare(
    "create table if not exists app_state (key text primary key, value text not null, version integer not null default 0, updated_at text not null default (datetime('now')))",
  )
    .bind()
    .run();
  return env.DB;
}

type Row = { value: string; version: number };
export const read = (d1: D1) => d1.prepare("select value, version from app_state where key = 'orders'").bind().first<Row>();

export type Doc = Record<string, string>;

/**
 * Read-modify-write with the same optimistic version check the page uses.
 * Retries a few times if another device saved in between (D1 single-row
 * conditional update guarantees nobody's save is overwritten).
 */
export async function mutate<T>(fn: (doc: Doc) => { result: T; changed: boolean }): Promise<{ result: T; version: number; data: Doc }> {
  const d1 = await db();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await read(d1);
    const current = row?.version ?? 0;
    const doc: Doc = row ? JSON.parse(row.value) : {};
    const { result, changed } = fn(doc);
    if (!changed) return { result, version: current, data: doc };
    const value = JSON.stringify(doc);
    if (value.length > 2_000_000) throw new Error("Too large");
    const res = (await (row
      ? d1.prepare("update app_state set value = ?1, version = ?2, updated_at = datetime('now') where key = 'orders' and version = ?3").bind(value, current + 1, current).run()
      : d1.prepare("insert or ignore into app_state (key, value, version) values ('orders', ?1, ?2)").bind(value, current + 1).run())) as { meta?: { changes?: number } };
    if ((res?.meta?.changes ?? 1) > 0) return { result, version: current + 1, data: doc };
  }
  throw new Error("Busy, try again");
}

// ---- Ports of the /orders page logic (public/orders/index.html + logic.js) ----
type Figure = Record<string, unknown> & { stage?: string };
export type Order = Record<string, unknown> & { id?: string; figures?: Figure[] };

export const listOf = (value: string | undefined): Order[] => {
  try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};
const idsOf = (value: string | undefined): string[] => {
  try { const v = JSON.parse(value || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
};

export function done(status: unknown) {
  return ["completed", "done", "shipped", "cancelled", "canceled"].includes(String(status || "").trim().toLowerCase());
}
export function painterOf(order: Order) {
  if (order?.painter === "local" || order?.painter === "remote") return order.painter;
  return Number(order?.rushDays) > 0 ? "local" : "remote";
}
const BLANK = { printStarted: "", printFinished: "", shipOut: "", expectedArrival: "", actualArrival: "", paintStarted: "", paintFinished: "" };
export function withFigures(order: Order): Order {
  const qty = Number(order.qty) || 1;
  const existing = Array.isArray(order.figures) ? order.figures : [];
  const figures: Figure[] = [];
  for (let i = 0; i < qty; i += 1) {
    const current = existing[i];
    figures.push(current && current.stage ? { stage: "Pending", ...BLANK, ...current } : { stage: done(order.status) ? "Completed" : "Pending", ...BLANK });
  }
  return { ...order, painter: painterOf(order), figures };
}
function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Page's nowStamp() in the shop's local time; the app may pass its own. */
export function nowStamp(clientNow?: unknown) {
  if (typeof clientNow === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clientNow)) return clientNow;
  const d = new Date(Date.now() + 8 * 3600_000); // Asia/Manila
  return `${isoDate(d)}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
function shipDays(doc: Doc) {
  const saved = Number(doc["hax-ship-days"]);
  return doc["hax-ship-days"] != null && Number.isFinite(saved) && saved >= 0 ? saved : 1;
}
export function moveFigure(figure: Figure, stage: string, now: string, doc: Doc): Figure {
  const next = { ...figure, stage };
  if (stage === "Pending") return { ...next, printStarted: "", printFinished: "", paintStarted: "", paintFinished: "" };
  if (stage === "Printing") return { ...next, printStarted: figure.printStarted || now, printFinished: "" };
  if (stage === "Ready for Ship-out") return { ...next, printFinished: figure.stage === "Shipped" ? "" : (figure.printFinished || now), shipOut: "", expectedArrival: "", actualArrival: "" };
  if (stage === "Shipped") {
    const shipOut = String(figure.shipOut || now);
    const [y, m, d] = shipOut.slice(0, 10).split("-").map(Number);
    const arrival = new Date(Date.UTC(y, m - 1, d + shipDays(doc)));
    return { ...next, printFinished: figure.printFinished || now, shipOut, expectedArrival: figure.expectedArrival || isoDate(arrival), actualArrival: "" };
  }
  if (stage === "Received") {
    if (figure.stage === "Painting") return { ...next, paintStarted: "", actualArrival: figure.actualArrival };
    return { ...next, actualArrival: now };
  }
  if (stage === "Ready for Painting") return { ...next, printStarted: figure.printStarted || now, printFinished: figure.stage === "Painting" ? "" : (figure.printFinished || now), paintStarted: "" };
  if (stage === "Painting") return { ...next, paintStarted: figure.stage === "Completed" ? figure.paintStarted : figure.paintStarted || now, paintFinished: "" };
  if (stage === "Shipping") return { ...next, printFinished: figure.printFinished || now, paintFinished: figure.paintFinished || now };
  if (stage === "Completed") return { ...next, paintFinished: figure.paintFinished || now };
  return next;
}
export function settle(order: Order): Order {
  return { ...order, status: "Completed", paid: Number(order.paid || 0) + Number(order.balance || 0), balance: 0 };
}
export const STAGES = ["Pending", "Printing", "Ready for Ship-out", "Shipped", "Received", "Ready for Painting", "Painting", "Shipping", "Completed", "On Hold", "Cancelled"];

/** Page's Confirm/Decline click handler + resolvePending(). */
export function resolvePending(doc: Doc, id: string, action: "confirm" | "decline") {
  const resolved = idsOf(doc["hax-pending-resolved"]);
  const pending = listOf(doc["hax-orders-pending"]);
  const item = pending.find((p) => p && p.id === id && !resolved.includes(id));
  if (!item) return false;
  if (action === "confirm") {
    const orders = listOf(doc["hax-orders"]).map(withFigures);
    const have = new Set(orders.map((o) => o.id));
    for (const row of (Array.isArray(item.orders) ? item.orders : []) as Order[]) if (!have.has(row.id)) orders.push(withFigures(row));
    doc["hax-orders"] = JSON.stringify(orders);
  }
  if (!resolved.includes(id)) resolved.push(id);
  doc["hax-pending-resolved"] = JSON.stringify(resolved.slice(-500));
  doc["hax-orders-pending"] = JSON.stringify(pending.filter((p) => p && p.id !== id));
  return true;
}

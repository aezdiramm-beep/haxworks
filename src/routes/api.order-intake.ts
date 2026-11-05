import { createFileRoute } from "@tanstack/react-router";

import { calculateCheckout, CUSTOM_COLOR, CUSTOM_COLOR_FEE } from "@/lib/order-checkout";
import { paymentTokenHash as hashPaymentToken } from "@/lib/order-payment";

// Public checkout stores one lead per figure. Fees and deposit are recalculated here.
type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
      first<T>(): Promise<T | null>;
    };
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const clean = (value: unknown, max: number) =>
  String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function db(): Promise<D1> {
  const { env } = (await import("cloudflare:workers")) as unknown as { env: { DB?: D1 } };
  if (!env.DB) throw new Error("D1 binding `DB` is missing");
  await env.DB.prepare(
    "create table if not exists app_state (key text primary key, value text not null, version integer not null default 0, updated_at text not null default (datetime('now')))",
  ).bind().run();
  await env.DB.prepare(
    "create table if not exists order_intake_log (id integer primary key autoincrement, ip text not null, created_at text not null default (datetime('now')))",
  ).bind().run();
  return env.DB;
}

export const Route = createFileRoute("/api/order-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return json({ error: "Bad request" }, 400);

        // Spam traps: hidden field filled in, or form submitted impossibly fast.
        if (clean(body.website, 50) || !Number.isFinite(Number(body.seconds)) || Number(body.seconds) < 3) return json({ error: "Please review your order and try again." }, 400);

        const name = clean(body.facebookName, 80);
        if (!name) return json({ error: "Please enter your Facebook name." }, 400);
        if (body.agreementAccepted !== true) return json({ error: "Please accept the order agreement before placing your order." }, 400);
        let checkout: ReturnType<typeof calculateCheckout>;
        try { checkout = calculateCheckout(body); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "Please check your order." }, 400); }
        const { items, accessoryFee, rushFee, total, payNow } = checkout;
        const due = "";
        const contact = name;
        const method = "QR / bank transfer";
        const paymentToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const paymentTokenHash = await hashPaymentToken(paymentToken);

        const d1 = await db();
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const recent = await d1
          .prepare("select count(*) as n from order_intake_log where ip = ?1 and created_at > datetime('now', '-1 hour')")
          .bind(ip)
          .first<{ n: number }>();
        if ((recent?.n ?? 0) >= 5) return json({ error: "Too many orders from this connection. Please message us on Facebook." }, 429);

        const money = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
        // One order row per figure line, all sharing the same order number.
        const base = Date.now();
        const ref = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
        const orders = items.map((it, i) => {
          const note = [
            `🛒 Order #${ref}${items.length > 1 ? ` (figure ${i + 1} of ${items.length})` : ""}`,
            `Box color: ${it.color}${it.color === CUSTOM_COLOR ? ` (+${money(CUSTOM_COLOR_FEE)} per figure, included)` : ""}`,
            `Name on box: ${it.boxName}`,
            `Facebook name: ${name}`,
            ...(i === 0 ? [`Accessory fee: ${money(accessoryFee)}`, `Rush fee: ${money(rushFee)}`] : [`Order-level fees noted on figure 1 of #${ref}`]),
            "Order agreement accepted (v2) · Lead time: 15–20 days",
            i === 0
              ? `Says paying ${money(payNow)}${method ? ` via ${method}` : ""} (50% down) for the whole order of ${money(total)} — check payment`
              : `Payment is noted on figure 1 of order #${ref}`,
          ].join(" · ");
          return { id: String(base + i), ref, name, size: it.size, qty: it.qty, boxColor: it.color, boxName: it.boxName, due, paid: 0, balance: it.price + (i === 0 ? accessoryFee + rushFee : 0), accessoryFee: i === 0 ? accessoryFee : 0, rushFee: i === 0 ? rushFee : 0, paymentTokenHash, status: "Pending", note, rushDays: 0, source: "online" };
        });
        // Waits in "Pending approval" on /orders; Confirm moves `orders` into hax-orders.
        const pending = {
          id: `p${base}`,
          ref,
          createdAt: new Date(base).toISOString(),
          name,
          contact,
          due,
          method,
          payMode: "dp",
          accessoryFee,
          rushFee,
          paymentTokenHash,
          payNow,
          total,
          agreement: { accepted: true, version: "v2", acceptedAt: new Date(base).toISOString() },
          items: items.map((it) => ({ ...it, customFee: it.color === CUSTOM_COLOR ? CUSTOM_COLOR_FEE * it.qty : 0, lineTotal: it.price * it.qty })),
          orders,
        };

        // Append to the shared orders list; retry if another device saved at the same moment.
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const row = await d1.prepare("select value, version from app_state where key = 'orders'").bind().first<{ value: string; version: number }>();
          const doc: Record<string, string> = row ? JSON.parse(row.value) : {};
          let list: unknown[] = [];
          try { list = JSON.parse(doc["hax-orders-pending"] || "[]"); } catch { list = []; }
          if (!Array.isArray(list)) list = [];
          list.push(pending);
          doc["hax-orders-pending"] = JSON.stringify(list);
          const version = row?.version ?? 0;
          const result = row
            ? await d1.prepare("update app_state set value = ?1, version = ?2, updated_at = datetime('now') where key = 'orders' and version = ?3").bind(JSON.stringify(doc), version + 1, version).run()
            : await d1.prepare("insert or ignore into app_state (key, value, version) values ('orders', ?1, 1)").bind(JSON.stringify(doc)).run();
          if ((result.meta?.changes ?? 0) > 0) {
            await d1.prepare("insert into order_intake_log (ip) values (?1)").bind(ip).run();
            return json({ ok: true, ref, total, payNow, accessoryFee, rushFee, items, paymentToken });
          }
        }
        return json({ error: "We couldn't save your order. Please try again." }, 503);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

/**
 * Public order form (/place-order) -> the "Pending approval" list on the
 * password-protected /orders page (stored under `hax-orders-pending` in the shared
 * orders doc). Nothing goes into the official `hax-orders` list until it is
 * confirmed there. The browser is never trusted for money: sizes, prices and the
 * custom-build fee are re-checked here.
 */
const PRICES: Record<string, number> = { 'Standard 4"': 899, 'Super 6"': 1799, 'Jumbo 10"': 6499 };
const CUSTOM = "Custom - Build it with us";
/** Added to each figure (per piece) whose box option is the custom build. */
const CUSTOM_FEE = 100;
const COLORS = ["Plum", "Blush Pink", "Sunset Orange", "Midnight Black", "Royal Blue", "Burgundy", CUSTOM];

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
        if (clean(body.website, 50) || Number(body.seconds) < 3) return json({ ok: true, ref: "00000", total: 0, payNow: 0 });

        const name = clean(body.name, 80);
        const contact = clean(body.contact, 120);
        if (!name || !contact) return json({ error: "Please enter your name and how to reach you." }, 400);

        // One or more figure lines. (An old single size/color/qty form is still accepted.)
        const rawItems = Array.isArray(body.items) ? body.items : [{ size: body.size, color: body.color, qty: body.qty }];
        if (rawItems.length < 1 || rawItems.length > 8) return json({ error: "Please add 1 to 8 figures." }, 400);
        const items: { size: string; color: string; qty: number; price: number; boxName: string }[] = [];
        for (const raw of rawItems as Record<string, unknown>[]) {
          const size = clean(raw?.size, 20);
          const color = clean(raw?.color, 40);
          const qty = Math.round(Number(raw?.qty));
          const boxName = clean(raw?.boxName, 13);
          if (!boxName) return json({ error: "Please type the name for every box (max 13 characters)." }, 400);
          if (!PRICES[size]) return json({ error: "Please choose a size for every figure." }, 400);
          if (!COLORS.includes(color)) return json({ error: "Please choose a box color (or Custom - Build it with us) for every figure." }, 400);
          if (!(qty >= 1 && qty <= 10)) return json({ error: "Quantity must be 1 to 10." }, 400);
          items.push({ size, color, qty, price: PRICES[size] + (color === CUSTOM ? CUSTOM_FEE : 0), boxName });
        }

        const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
        const custom = body.payMode === "custom";
        const payNow = custom ? Math.round(Number(body.customAmount) * 100) / 100 : Math.ceil(total / 2);
        if (!(payNow > 0) || payNow > 200000) return json({ error: "Please enter a valid payment amount." }, 400);
        const dueRaw = clean(body.due, 10);
        const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : "";
        const method = clean(body.method, 30);

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
        const ref = String(base).slice(-5);
        const orders = items.map((it, i) => {
          const note = [
            `🛒 Order #${ref}${items.length > 1 ? ` (figure ${i + 1} of ${items.length})` : ""}`,
            `Box: ${it.color}${it.color === CUSTOM ? ` (+${money(CUSTOM_FEE)} per figure, included)` : ""}`,
            `Name on box: ${it.boxName}`,
            `Contact: ${contact}`,
            i === 0
              ? `Says paying ${money(payNow)}${method ? ` via ${method}` : ""} (${custom ? "custom amount" : "50% down"}) for the whole order of ${money(total)} — check payment`
              : `Payment is noted on figure 1 of order #${ref}`,
          ].join(" · ");
          return { id: String(base + i), name, size: it.size, qty: it.qty, due, paid: 0, balance: it.price * it.qty, status: "Pending", note, rushDays: 0, source: "online" };
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
          payMode: custom ? "custom" : "dp",
          payNow,
          total,
          items: items.map((it) => ({ ...it, customFee: it.color === CUSTOM ? CUSTOM_FEE * it.qty : 0, lineTotal: it.price * it.qty })),
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
            return json({ ok: true, ref, total, payNow });
          }
        }
        return json({ error: "We couldn't save your order. Please try again." }, 503);
      },
    },
  },
});

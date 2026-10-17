import { createFileRoute } from "@tanstack/react-router";

/**
 * Public order form -> the shared orders list (same data the password-protected
 * /orders page shows). The browser is never trusted for money: sizes and prices
 * are re-checked here.
 */
const PRICES: Record<string, number> = { 'Standard 4"': 899, 'Super 6"': 1799, 'Jumbo 10"': 6499 };
const COLORS = ["Plum", "Blush Pink", "Sunset Orange", "Midnight Black", "Royal Blue", "Burgundy", "Custom design / color"];

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

        const size = clean(body.size, 20);
        const price = PRICES[size];
        const color = clean(body.color, 40);
        const qty = Math.round(Number(body.qty));
        const name = clean(body.name, 80);
        const contact = clean(body.contact, 120);
        if (!price) return json({ error: "Please choose a size." }, 400);
        if (!COLORS.includes(color)) return json({ error: "Please choose a box color." }, 400);
        if (!(qty >= 1 && qty <= 10)) return json({ error: "Quantity must be 1 to 10." }, 400);
        if (!name || !contact) return json({ error: "Please enter your name and how to reach you." }, 400);

        const total = price * qty;
        const custom = body.payMode === "custom";
        const payNow = custom ? Math.round(Number(body.customAmount) * 100) / 100 : Math.ceil(total / 2);
        if (!(payNow > 0) || payNow > 200000) return json({ error: "Please enter a valid payment amount." }, 400);
        const dueRaw = clean(body.due, 10);
        const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : "";
        const details = clean(body.details, 600);
        const method = clean(body.method, 30);

        const d1 = await db();
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        const recent = await d1
          .prepare("select count(*) as n from order_intake_log where ip = ?1 and created_at > datetime('now', '-1 hour')")
          .bind(ip)
          .first<{ n: number }>();
        if ((recent?.n ?? 0) >= 5) return json({ error: "Too many orders from this connection. Please message us on Facebook." }, 429);

        const money = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
        const note = [
          "🌐 Online order",
          `Box: ${color}`,
          `Contact: ${contact}`,
          `Says paying ${money(payNow)}${method ? ` via ${method}` : ""} (${custom ? "custom amount" : "50% down"}) — check payment`,
          details ? `Details: ${details}` : "",
        ].filter(Boolean).join(" · ");

        // Append to the shared orders list; retry if another device saved at the same moment.
        const id = `${Date.now()}`;
        const order = { id, name, size, qty, due, paid: 0, balance: total, status: "Pending", note, rushDays: 0, source: "online" };
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const row = await d1.prepare("select value, version from app_state where key = 'orders'").bind().first<{ value: string; version: number }>();
          const doc: Record<string, string> = row ? JSON.parse(row.value) : {};
          let list: unknown[] = [];
          try { list = JSON.parse(doc["hax-orders"] || "[]"); } catch { list = []; }
          if (!Array.isArray(list)) list = [];
          list.push(order);
          doc["hax-orders"] = JSON.stringify(list);
          const version = row?.version ?? 0;
          const result = row
            ? await d1.prepare("update app_state set value = ?1, version = ?2, updated_at = datetime('now') where key = 'orders' and version = ?3").bind(JSON.stringify(doc), version + 1, version).run()
            : await d1.prepare("insert or ignore into app_state (key, value, version) values ('orders', ?1, 1)").bind(JSON.stringify(doc)).run();
          if ((result.meta?.changes ?? 0) > 0) {
            await d1.prepare("insert into order_intake_log (ip) values (?1)").bind(ip).run();
            return json({ ok: true, ref: id.slice(-5), total, payNow });
          }
        }
        return json({ error: "We couldn't save your order. Please try again." }, 503);
      },
    },
  },
});

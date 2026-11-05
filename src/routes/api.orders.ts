import { createFileRoute } from "@tanstack/react-router";

/**
 * Shared orders storage for every device (D1) behind a password.
 *   POST { password }              -> sets a login cookie
 *   GET                            -> { data, version }
 *   PUT  { data, baseVersion }     -> saves; 409 if another device saved first
 * Password: ORDERS_PASSWORD secret (falls back to HW123 until you set one).
 */
import { COOKIE, authed, db, json, mutate, password, read, same, token } from "@/lib/orders-store.server";
import { assignOrderReferences } from "@/lib/order-references";

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const given = String((body as { password?: unknown }).password ?? "");
        if (!same(given, password())) return json({ error: "Wrong password" }, 401);
        const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
        return json({ ok: true }, 200, {
          "set-cookie": `${COOKIE}=${await token()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
        });
      },
      GET: async ({ request }) => {
        if (!(await authed(request))) return json({ error: "Login required" }, 401);
        const out = await mutate((doc) => ({ result: null, changed: assignOrderReferences(doc) }));
        return json({ data: out.data, version: out.version });
      },
      PUT: async ({ request }) => {
        if (!(await authed(request))) return json({ error: "Login required" }, 401);
        const body = (await request.json().catch(() => null)) as { data?: Record<string, unknown>; baseVersion?: number } | null;
        if (!body || typeof body.data !== "object" || body.data === null) return json({ error: "Bad request" }, 400);
        const d1 = await db();
        const row = await read(d1);
        const current = row?.version ?? 0;
        if (Number(body.baseVersion) !== current) {
          return json({ error: "Changed on another device", data: row ? JSON.parse(row.value) : {}, version: current }, 409);
        }
        const data = body.data as Record<string, string>;
        assignOrderReferences(data);
        const value = JSON.stringify(data);
        if (value.length > 2_000_000) return json({ error: "Too large" }, 413);
        await d1
          .prepare("insert into app_state (key, value, version) values ('orders', ?1, ?2) on conflict(key) do update set value = ?1, version = ?2, updated_at = datetime('now')")
          .bind(value, current + 1)
          .run();
        return json({ ok: true, version: current + 1 });
      },
    },
  },
});

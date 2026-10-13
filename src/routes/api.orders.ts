import { createFileRoute } from "@tanstack/react-router";

/**
 * Shared orders storage for every device (D1) behind a password.
 *   POST { password }              -> sets a login cookie
 *   GET                            -> { data, version }
 *   PUT  { data, baseVersion }     -> saves; 409 if another device saved first
 * Password: ORDERS_PASSWORD secret (falls back to HW123 until you set one).
 */
type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
    };
  };
};

const COOKIE = "hax_orders";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const password = () => process.env.ORDERS_PASSWORD?.trim() || "HW123";

async function token(): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("haxworks-orders-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authed(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  return Boolean(match) && same(match!.slice(COOKIE.length + 1), await token());
}

async function db(): Promise<D1> {
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
const read = (d1: D1) => d1.prepare("select value, version from app_state where key = 'orders'").bind().first<Row>();

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
        const row = await read(await db());
        return json({ data: row ? JSON.parse(row.value) : {}, version: row?.version ?? 0 });
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
        const value = JSON.stringify(body.data);
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

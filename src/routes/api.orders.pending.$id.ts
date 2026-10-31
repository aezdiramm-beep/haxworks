import { createFileRoute } from "@tanstack/react-router";
import { authed, json, mutate, resolvePending } from "@/lib/orders-store.server";

/** POST { action: "confirm" | "decline" } — same effect as the buttons on /orders. */
export const Route = createFileRoute("/api/orders/pending/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!(await authed(request))) return json({ error: "Login required" }, 401);
        const body = (await request.json().catch(() => ({}))) as { action?: string };
        const action = body.action === "confirm" ? "confirm" : body.action === "decline" ? "decline" : null;
        if (!action) return json({ error: "Bad action" }, 400);
        try {
          const out = await mutate((doc) => {
            const ok = resolvePending(doc, params.id, action);
            return { result: ok, changed: ok };
          });
          if (!out.result) return json({ error: "Not found (already handled?)", data: out.data, version: out.version }, 404);
          return json({ ok: true, data: out.data, version: out.version });
        } catch (err) {
          return json({ error: String((err as Error).message || err) }, 503);
        }
      },
    },
  },
});

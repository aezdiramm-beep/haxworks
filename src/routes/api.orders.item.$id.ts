import { createFileRoute } from "@tanstack/react-router";
import { authed, done, json, listOf, moveFigure, mutate, nowStamp, settle, STAGES, withFigures } from "@/lib/orders-store.server";

/**
 * PATCH { figure: number, stage: string, now?: "YYYY-MM-DDTHH:MM" } -> move one figure's stage
 * PATCH { settle: true }                                          -> "Mark paid in full"
 * Same rules as the /orders page (moveFigure / settle).
 */
export const Route = createFileRoute("/api/orders/item/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        if (!(await authed(request))) return json({ error: "Login required" }, 401);
        const body = (await request.json().catch(() => null)) as { figure?: number; stage?: string; settle?: boolean; now?: string } | null;
        if (!body) return json({ error: "Bad request" }, 400);
        const wantsStage = typeof body.stage === "string";
        if (wantsStage && !STAGES.includes(body.stage!)) return json({ error: "Unknown stage" }, 400);
        if (!wantsStage && body.settle !== true) return json({ error: "Nothing to change" }, 400);
        const index = Number(body.figure ?? 0);
        try {
          const out = await mutate((doc) => {
            const orders = listOf(doc["hax-orders"]);
            const at = orders.findIndex((o) => o && o.id === params.id);
            if (at < 0) return { result: "missing", changed: false };
            let order = orders[at];
            if (wantsStage) {
              const figures = withFigures(order).figures!;
              if (!Number.isInteger(index) || index < 0 || index >= figures.length) return { result: "badfigure", changed: false };
              const now = nowStamp(body.now);
              order = { ...order, figures: figures.map((f, i) => (i === index ? { ...moveFigure(f, body.stage!, now, doc), rework: "" } : f)) };
            } else {
              if (done(order.status)) return { result: "ok", changed: false };
              order = settle(order);
            }
            orders[at] = order;
            doc["hax-orders"] = JSON.stringify(orders);
            return { result: "ok", changed: true };
          });
          if (out.result === "missing") return json({ error: "Order not found" }, 404);
          if (out.result === "badfigure") return json({ error: "Bad figure index" }, 400);
          return json({ ok: true, data: out.data, version: out.version });
        } catch (err) {
          return json({ error: String((err as Error).message || err) }, 503);
        }
      },
    },
  },
});

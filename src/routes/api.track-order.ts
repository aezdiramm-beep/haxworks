import { createFileRoute } from "@tanstack/react-router";
import { db, read, json } from "@/lib/orders-store.server";
import { normalizeOrderRef, trackOrder } from "@/lib/order-tracking";

export const Route = createFileRoute("/api/track-order")({
  server: { handlers: {
    POST: async ({ request }) => {
      const body = await request.json().catch(() => null);
      const ref = normalizeOrderRef(body?.ref);
      if (!/^(?:\d{5}|[A-F0-9]{12})$/.test(ref)) return json({ error: "Enter the order number shown on your confirmation page." }, 400);
      try {
        const row = await read(await db());
        const result = trackOrder(row ? JSON.parse(row.value) : {}, ref);
        if (!result) return json({ error: "We couldn't find a unique order with that number. Check your confirmation or message us for help." }, 404);
        return json(result);
      } catch {
        return json({ error: "Tracking is temporarily unavailable. Please try again shortly." }, 503);
      }
    },
  } },
});

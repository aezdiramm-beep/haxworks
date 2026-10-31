import { createFileRoute } from "@tanstack/react-router";
import { json, password, same, token } from "@/lib/orders-store.server";

/** Native app login: POST { password } -> { token } (send as `Authorization: Bearer <token>`). */
export const Route = createFileRoute("/api/orders/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const given = String((body as { password?: unknown }).password ?? "");
        if (!same(given, password())) return json({ error: "Wrong password" }, 401);
        return json({ token: await token() });
      },
    },
  },
});

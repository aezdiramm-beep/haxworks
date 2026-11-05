import { createFileRoute } from "@tanstack/react-router";
import { json, mutate } from "@/lib/orders-store.server";
import { paymentTokenHash, reportOrderPayment } from "@/lib/order-payment";

export const Route = createFileRoute("/api/order-payment")({
  server: { handlers: {
    POST: async ({ request }) => {
      const body = await request.json().catch(() => null);
      if (!/^[A-F0-9]{12}$/.test(body?.ref || "") || !/^[a-f0-9]{64}$/.test(body?.token || "")) return json({ error: "Open the payment page for your order and try again." }, 400);
      try {
        const hash = await paymentTokenHash(body.token);
        const out = await mutate((doc) => {
          const result = reportOrderPayment(doc, body.ref, hash);
          return { result: result.found, changed: result.changed };
        });
        if (!out.result) return json({ error: "We couldn't find this payment session. Please message us with your order number." }, 404);
        return json({ ok: true, payment: "reported" });
      } catch {
        return json({ error: "Couldn't save your payment update. Please try again." }, 503);
      }
    },
  } },
});

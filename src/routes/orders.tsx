import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  server: {
    handlers: {
      GET: async () => {
        const { deskPage } = await import("@/lib/desk-page.server");
        return deskPage("orders");
      },
    },
  },
});

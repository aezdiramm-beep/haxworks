import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/place-order")({
  server: { handlers: {
    GET: async () => {
      const { deskPage } = await import("@/lib/desk-page.server");
      return deskPage("place-order");
    },
  } },
});

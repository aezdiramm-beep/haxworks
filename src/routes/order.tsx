import { createFileRoute } from "@tanstack/react-router";

/** Old customer order link (/order, printed QR codes) -> the new /place-order page. */
const toPlaceOrder = ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  return new Response(null, {
    status: 301,
    headers: { location: `/place-order${url.search}`, "cache-control": "public, max-age=3600" },
  });
};

export const Route = createFileRoute("/order")({
  server: { handlers: { GET: toPlaceOrder, HEAD: toPlaceOrder } },
});

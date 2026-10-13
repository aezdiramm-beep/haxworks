import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/site-file")({
  server: {
    handlers: {
      GET: async () => {
        const body = readFileSync(join(process.cwd(), "public", "haxworks-cloudflare.zip"));
        return new Response(body, {
          headers: {
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="haxworks-cloudflare.zip"',
          },
        });
      },
    },
  },
});

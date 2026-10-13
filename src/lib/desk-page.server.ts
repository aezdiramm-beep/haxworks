import { readFileSync } from "node:fs";
import { join } from "node:path";

export function deskPage(name: string) {
  const html = readFileSync(join(process.cwd(), "public", name, "index.html"));
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

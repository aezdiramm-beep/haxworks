import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const brief = String(body.brief || "").slice(0, 12000);
        const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
        const transcript = messages
          .map((message: { role?: string; text?: string }) => {
            const role = message.role === "assistant" ? "Assistant" : "Owner";
            return `${role}: ${String(message.text || "").slice(0, 800)}`;
          })
          .join("\n");
        try {
          const { askDesk } = await import("@/lib/gemini.server");
          const result = await askDesk(brief, transcript);
          return Response.json({ reply: result.reply, changes: result.changes });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Could not answer" }, { status: 500 });
        }
      },
    },
  },
});

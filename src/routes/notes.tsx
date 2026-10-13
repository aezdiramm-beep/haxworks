import { createFileRoute } from "@tanstack/react-router";
import { listPrivateNotes } from "@/lib/review-notes";

export const Route = createFileRoute("/notes")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { k?: string } = {};
    if (typeof search.k === "string" && search.k) result.k = search.k;
    return result;
  },
  loaderDeps: ({ search }) => ({ k: search.k ?? "" }),
  loader: ({ deps }) => listPrivateNotes({ data: { key: deps.k } }),
  head: () => ({
    meta: [
      { title: "Notes — Haxworks" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const notes = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="px-6 py-5">
        <a href="/" className="text-sm font-extrabold tracking-widest">
          HAXWORKS
        </a>
      </header>
      <div className="mx-auto w-full max-w-lg px-6 pb-20">
        {notes === null ? (
          <p className="mt-16 text-sm text-muted">This page isn’t available.</p>
        ) : (
          <>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight">Private notes</h1>
            <p className="mt-2 text-sm text-muted">1–3 star reviews. Nothing here is public.</p>
            {notes.length === 0 ? (
              <p className="mt-8 text-sm">No notes yet.</p>
            ) : (
              <ul className="mt-8 flex flex-col gap-3">
                {notes.map((entry) => (
                  <li key={entry.id} className="rounded-2xl bg-mist px-4 py-4">
                    <p className="text-xs text-muted">
                      {entry.score} star{entry.score === 1 ? "" : "s"}
                      {entry.name ? ` · ${entry.name}` : ""}
                      {entry.createdAt ? ` · ${entry.createdAt} UTC` : ""}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{entry.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

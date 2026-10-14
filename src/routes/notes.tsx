import { createFileRoute } from "@tanstack/react-router";
import { listPrivateClicks, listPrivateNotes } from "@/lib/review-notes";

export const Route = createFileRoute("/notes")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { k?: string } = {};
    if (typeof search.k === "string" && search.k) result.k = search.k;
    return result;
  },
  loaderDeps: ({ search }) => ({ k: search.k ?? "" }),
  loader: async ({ deps }) => {
    const [notes, clicks] = await Promise.all([
      listPrivateNotes({ data: { key: deps.k } }),
      listPrivateClicks({ data: { key: deps.k } }),
    ]);
    return { notes, clicks };
  },
  head: () => ({
    meta: [
      { title: "Notes — Haxworks" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { notes, clicks } = Route.useLoaderData();

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

            <h2 className="mt-14 text-2xl font-semibold tracking-tight">Star taps</h2>
            <p className="mt-2 text-sm text-muted">
              Every star someone tapped on the review page, including 4–5 stars sent to Facebook. Times are Philippine time.
            </p>
            {!clicks || clicks.recent.length === 0 ? (
              <p className="mt-6 text-sm">No taps yet.</p>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-5 gap-2 text-center">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="rounded-2xl bg-mist px-2 py-3">
                      <p className="text-xs text-muted">{star}★</p>
                      <p className="text-xl font-semibold">{clicks.totals.find((row) => row.score === star)?.count ?? 0}</p>
                    </div>
                  ))}
                </div>
                <ul className="mt-4 flex flex-col gap-1 text-sm">
                  {clicks.recent.map((entry) => (
                    <li key={entry.id} className="flex justify-between border-b border-line py-2">
                      <span>
                        {entry.score}★ · {entry.destination === "facebook" ? "sent to Facebook" : "opened the private note form"}
                      </span>
                      <span className="text-muted">{entry.at}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

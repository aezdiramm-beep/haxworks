import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>) => {
    const score = Number(search.score);
    const result: { score?: number; sent?: "1" } = {};
    if (score >= 1 && score <= 3) result.score = score;
    if (search.sent === "1" || search.sent === 1) result.sent = "1";
    return result;
  },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const back = new URL("/review", request.url);
        const note = String(form.get("note") || "").trim().slice(0, 4000);
        const name = String(form.get("name") || "").trim().slice(0, 120);
        const score = Number(form.get("score"));
        const trap = String(form.get("_honey") || "").trim();

        if (!trap && note && score >= 1 && score <= 3) {
          const { saveReviewNote } = await import("@/lib/review-notes.server");
          await saveReviewNote({ score, note, name });
        }

        back.searchParams.set("sent", "1");
        return Response.redirect(back, 303);
      },
    },
  },
  head: () => ({
    meta: [{ title: "Thanks — Haxworks" }],
  }),
  component: ReviewPage,
});


function ReviewPage() {
  const { score = 0, sent } = Route.useSearch();

  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="px-6 py-5">
        <a href="/" className="text-sm font-extrabold tracking-widest">
          HAXWORKS
        </a>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-20">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">A small favor</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Please support our small business.</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          A short review helps us more than you know.
        </p>

        <div className="star-row mt-10" aria-label="Rating from 1 to 5">
          {[5, 4, 3, 2, 1].map((star) => (
            <a
              key={star}
              href={`/api/review-click?score=${star}`}
              className={star <= score ? "is-on" : undefined}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
            >
              <Star strokeWidth={1.5} />
            </a>
          ))}
        </div>
        <div className="mt-1 flex justify-between px-3 text-xs text-muted">
          <span>Not great</span>
          <span>Loved it</span>
        </div>

        {sent ? (
          <p className="mt-8 rounded-2xl bg-mist px-4 py-4 text-sm leading-relaxed">
            Got it. This will help us improve. We’re eager to do better.
          </p>
        ) : null}

        {!sent && score > 0 ? <PrivateNote score={score} /> : null}
      </div>
    </main>
  );
}

function PrivateNote({ score }: { score: number }) {
  return (
    <>
      <form id="note-form" className="mt-8" method="post" action="/review">
        <p className="text-sm leading-relaxed text-muted">Tell us what we should do better.</p>
        <input type="hidden" name="score" value={score} />
        <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true" />
        <label className="mt-4 block text-sm font-semibold" htmlFor="note">
          What happened
        </label>
        <textarea
          id="note"
          name="note"
          required
          className="mt-1 min-h-28 w-full rounded-2xl border border-line px-3 py-3 text-sm"
          placeholder="The figure, the wait, anything that missed."
        />
        <label className="mt-3 block text-sm font-semibold" htmlFor="name">
          Name <span className="font-normal text-muted">optional</span>
        </label>
        <input id="name" name="name" className="mt-1 w-full rounded-2xl border border-line px-3 py-3 text-sm" />
        <button type="submit" className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-medium text-inverse">
          Send note
        </button>
      </form>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";

const FACEBOOK_REVIEW_URL = "https://www.facebook.com/Haxworks3D/reviews";

/**
 * Every star on /review points here. We log the tap, then send the person on:
 * 4–5 stars -> Facebook reviews, 1–3 stars -> the private note form.
 * A logging failure never blocks the redirect.
 */
export const Route = createFileRoute("/api/review-click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const score = Math.round(Number(url.searchParams.get("score")));
        if (!(score >= 1 && score <= 5)) return Response.redirect(new URL("/review", url), 302);
        const destination = score >= 4 ? "facebook" : "form";
        try {
          const { logReviewClick } = await import("@/lib/review-notes.server");
          await logReviewClick(score, destination);
        } catch (error) {
          console.error("[review-click] could not log", error);
        }
        return Response.redirect(
          score >= 4 ? FACEBOOK_REVIEW_URL : new URL(`/review?score=${score}`, url),
          302,
        );
      },
    },
  },
});

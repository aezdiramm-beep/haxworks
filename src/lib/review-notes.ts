import { createServerFn } from "@tanstack/react-start";

export const listPrivateNotes = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const key =
      data && typeof data === "object" && "key" in data && typeof data.key === "string" ? data.key : "";
    return { key };
  })
  .handler(async ({ data }) => {
    const { listReviewNotes } = await import("./review-notes.server");
    return listReviewNotes(data.key);
  });

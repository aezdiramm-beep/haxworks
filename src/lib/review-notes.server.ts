const NOTES_KEY = "haxworks-notes-4f8c2a";

export type ReviewNote = {
  id: number;
  score: number;
  note: string;
  name: string | null;
  createdAt: string;
};

/** Minimal slice of the Cloudflare D1 binding we use. */
type D1 = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
};

/** The D1 database bound as `DB` in wrangler.jsonc. */
async function getDb(): Promise<D1> {
  const { env } = (await import("cloudflare:workers")) as unknown as { env: { DB?: D1 } };
  if (!env.DB) throw new Error("D1 binding `DB` is missing — see wrangler.jsonc");
  // Create the table on first use so no manual SQL step is needed.
  await env.DB.prepare(
    "create table if not exists review_notes (id integer primary key autoincrement, score integer not null check (score between 1 and 3), note text not null, name text, created_at text not null default (datetime('now')))",
  )
    .bind()
    .run();
  return env.DB;
}

export async function saveReviewNote(entry: { score: number; note: string; name: string }) {
  const db = await getDb();
  await db
    .prepare("insert into review_notes (score, note, name) values (?1, ?2, ?3)")
    .bind(entry.score, entry.note, entry.name || null)
    .run();
}

export async function listReviewNotes(key: string): Promise<ReviewNote[] | null> {
  if (key !== NOTES_KEY) return null;
  const db = await getDb();
  const { results } = await db
    .prepare(
      `select id, score, note, name,
        strftime('%Y-%m-%d %H:%M', created_at) as created_at
       from review_notes
       order by id desc`,
    )
    .bind()
    .all<{ id: number; score: number; note: string; name: string | null; created_at: string }>();
  return results.map((row) => ({
    id: Number(row.id),
    score: Number(row.score),
    note: row.note,
    name: row.name,
    createdAt: row.created_at,
  }));
}

create table if not exists review_notes (
  id integer primary key autoincrement,
  score integer not null check (score between 1 and 3),
  note text not null,
  name text,
  created_at text not null default (datetime('now'))
);

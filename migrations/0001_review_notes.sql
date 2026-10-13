create table if not exists review_notes (
  id bigserial primary key,
  score smallint not null check (score between 1 and 3),
  note text not null,
  name text,
  created_at timestamptz not null default now()
);

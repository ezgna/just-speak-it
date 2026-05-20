alter table public.diary_entries
add column summary_points jsonb not null default '[]'::jsonb;

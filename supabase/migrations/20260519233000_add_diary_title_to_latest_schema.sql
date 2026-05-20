alter table public.diary_entries
add column if not exists title text not null default '日記の記録';

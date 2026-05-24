alter table public.diary_entries
add column if not exists generation_mode text not null default 'natural';

alter table public.diary_entries
drop constraint if exists diary_entries_generation_mode_check;

alter table public.diary_entries
add constraint diary_entries_generation_mode_check
check (generation_mode in ('natural', 'compact'));

drop index if exists public.diary_entries_user_content_hash_uidx;

create unique index diary_entries_user_content_hash_uidx
on public.diary_entries (user_id, content_hash, generation_mode);

create extension if not exists pgcrypto;

alter table public.diary_entries
add column if not exists content_hash text,
add column if not exists generation_status text not null default 'completed',
add column if not exists generation_error text;

update public.diary_entries
set content_hash = encode(
  digest(regexp_replace(btrim(cleaned_text), '[[:space:]]+', ' ', 'g'), 'sha256'),
  'hex'
)
where content_hash is null;

with ranked_entries as (
  select
    id,
    row_number() over (
      partition by user_id, content_hash
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.diary_entries
)
delete from public.diary_entries
using ranked_entries
where public.diary_entries.id = ranked_entries.id
  and ranked_entries.duplicate_rank > 1;

alter table public.diary_entries
alter column content_hash set not null;

alter table public.diary_entries
drop constraint if exists diary_entries_generation_status_check;

alter table public.diary_entries
add constraint diary_entries_generation_status_check
check (generation_status in ('processing', 'completed', 'failed'));

create unique index if not exists diary_entries_user_content_hash_uidx
on public.diary_entries (user_id, content_hash);

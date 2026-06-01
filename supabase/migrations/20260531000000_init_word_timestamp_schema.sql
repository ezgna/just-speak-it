drop table if exists public.card_review_schedules cascade;
drop table if exists public.translation_card_attempts cascade;
drop table if exists public.review_schedules cascade;
drop table if exists public.practice_answers cascade;
drop table if exists public.practice_items cascade;
drop table if exists public.profiles cascade;
drop table if exists public.translation_cards cascade;
drop table if exists public.practice_generations cascade;
drop table if exists public.diary_entries cascade;

delete from auth.users where is_anonymous = true;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'voice' check (source in ('text', 'voice')),
  original_text text not null,
  plain_text text not null,
  polished_text text not null,
  bullet_points jsonb not null
    check (jsonb_typeof(bullet_points) = 'array' and jsonb_array_length(bullet_points) >= 1),
  transcript_words jsonb not null default '[]'::jsonb
    check (jsonb_typeof(transcript_words) = 'array'),
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
  generation_mode text not null default 'compact' check (generation_mode in ('natural', 'compact')),
  practice_generation_status text not null default 'draft'
    check (practice_generation_status in ('draft', 'translating', 'completed', 'failed')),
  practice_generation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translation_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_generation_id uuid not null references public.practice_generations(id) on delete cascade,
  sort_order integer not null default 0,
  japanese text not null,
  english text,
  source_word_start_index integer,
  source_word_end_index integer,
  audio_start_sec double precision,
  audio_end_sec double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint translation_cards_source_word_range_check
    check (
      source_word_start_index is null
      or source_word_end_index is null
      or source_word_start_index <= source_word_end_index
    ),
  constraint translation_cards_audio_range_check
    check (
      audio_start_sec is null
      or audio_end_sec is null
      or audio_start_sec <= audio_end_sec
    )
);

create index diary_entries_user_content_hash_idx
on public.diary_entries (user_id, content_hash);

create index diary_entries_user_created_idx
on public.diary_entries (user_id, created_at desc);

create index practice_generations_user_created_idx
on public.practice_generations (user_id, created_at desc);

create unique index practice_generations_diary_mode_uidx
on public.practice_generations (diary_entry_id, generation_mode);

create index practice_generations_diary_idx
on public.practice_generations (diary_entry_id, generation_mode);

create index translation_cards_user_created_idx
on public.translation_cards (user_id, created_at desc);

create unique index translation_cards_generation_sort_uidx
on public.translation_cards (practice_generation_id, sort_order);

create index translation_cards_generation_idx
on public.translation_cards (practice_generation_id, sort_order);

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row execute function public.set_updated_at();

create trigger practice_generations_set_updated_at
before update on public.practice_generations
for each row execute function public.set_updated_at();

create trigger translation_cards_set_updated_at
before update on public.translation_cards
for each row execute function public.set_updated_at();

alter table public.diary_entries enable row level security;
alter table public.practice_generations enable row level security;
alter table public.translation_cards enable row level security;

create policy "Users can manage own diary entries"
on public.diary_entries for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own practice generations"
on public.practice_generations for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own translation cards"
on public.translation_cards for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.diary_entries to authenticated;
grant select, insert, update, delete on public.practice_generations to authenticated;
grant select, insert, update, delete on public.translation_cards to authenticated;

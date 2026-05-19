drop table if exists public.card_review_schedules cascade;
drop table if exists public.translation_card_attempts cascade;
drop table if exists public.profiles cascade;
drop table if exists public.translation_cards cascade;
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
  raw_transcript_text text not null,
  cleaned_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translation_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
  sort_order integer not null default 0,
  japanese text not null,
  english text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diary_entries_user_created_idx on public.diary_entries (user_id, created_at desc);
create index translation_cards_user_created_idx on public.translation_cards (user_id, created_at desc);
create index translation_cards_diary_idx on public.translation_cards (diary_entry_id, sort_order);

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row execute function public.set_updated_at();

create trigger translation_cards_set_updated_at
before update on public.translation_cards
for each row execute function public.set_updated_at();

alter table public.diary_entries enable row level security;
alter table public.translation_cards enable row level security;

create policy "Users can manage own diary entries"
on public.diary_entries for all
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
grant select, insert, update, delete on public.translation_cards to authenticated;

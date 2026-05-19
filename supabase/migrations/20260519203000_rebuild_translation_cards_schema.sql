drop table if exists public.card_review_schedules cascade;
drop table if exists public.translation_cards cascade;
drop table if exists public.review_schedules cascade;
drop table if exists public.practice_answers cascade;
drop table if exists public.practice_items cascade;
drop table if exists public.diary_entries cascade;
drop table if exists public.profiles cascade;

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

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'voice' check (source in ('text', 'voice')),
  transcript_text text not null,
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

create table public.card_review_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_card_id uuid not null references public.translation_cards(id) on delete cascade,
  due_at timestamptz not null,
  interval_days integer not null default 1 check (interval_days > 0),
  ease_factor numeric(4, 2) not null default 2.50 check (ease_factor >= 1.30),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, translation_card_id)
);

create table public.translation_card_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_card_id uuid not null references public.translation_cards(id) on delete cascade,
  answer_text text not null,
  corrected_text text not null,
  feedback_summary text not null,
  score integer not null check (score between 1 and 5),
  retry_count integer not null default 1 check (retry_count > 0),
  created_at timestamptz not null default now()
);

create index diary_entries_user_created_idx on public.diary_entries (user_id, created_at desc);
create index translation_cards_user_created_idx on public.translation_cards (user_id, created_at desc);
create index translation_cards_diary_idx on public.translation_cards (diary_entry_id, sort_order);
create index card_review_schedules_due_idx on public.card_review_schedules (user_id, status, due_at);
create index translation_card_attempts_card_created_idx on public.translation_card_attempts (translation_card_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row execute function public.set_updated_at();

create trigger translation_cards_set_updated_at
before update on public.translation_cards
for each row execute function public.set_updated_at();

create trigger card_review_schedules_set_updated_at
before update on public.card_review_schedules
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.translation_cards enable row level security;
alter table public.card_review_schedules enable row level security;
alter table public.translation_card_attempts enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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

create policy "Users can manage own card review schedules"
on public.card_review_schedules for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own translation card attempts"
on public.translation_card_attempts for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.diary_entries to authenticated;
grant select, insert, update, delete on public.translation_cards to authenticated;
grant select, insert, update, delete on public.card_review_schedules to authenticated;
grant select, insert, update, delete on public.translation_card_attempts to authenticated;

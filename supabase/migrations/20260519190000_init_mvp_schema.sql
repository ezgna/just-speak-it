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
  source text not null default 'text' check (source in ('text', 'voice')),
  original_text text not null,
  transcript_text text,
  audio_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
  japanese text not null,
  intent text not null,
  natural_english text not null,
  simple_english text not null,
  pattern_label text not null,
  pattern text not null,
  short_phrase text not null,
  stuck_points text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_item_id uuid not null references public.practice_items(id) on delete cascade,
  answer_text text not null,
  corrected_text text not null,
  simple_text text not null,
  feedback_summary text not null,
  stuck_points text[] not null default '{}',
  score integer not null check (score between 1 and 5),
  retry_count integer not null default 1 check (retry_count > 0),
  created_at timestamptz not null default now()
);

create table public.review_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_item_id uuid not null references public.practice_items(id) on delete cascade,
  due_at timestamptz not null,
  interval_days integer not null default 1 check (interval_days > 0),
  ease_factor numeric(4, 2) not null default 2.50 check (ease_factor >= 1.30),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, practice_item_id)
);

create index diary_entries_user_created_idx on public.diary_entries (user_id, created_at desc);
create index practice_items_user_created_idx on public.practice_items (user_id, created_at desc);
create index practice_items_diary_idx on public.practice_items (diary_entry_id, sort_order);
create index practice_answers_item_created_idx on public.practice_answers (practice_item_id, created_at desc);
create index review_schedules_due_idx on public.review_schedules (user_id, status, due_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger diary_entries_set_updated_at
before update on public.diary_entries
for each row execute function public.set_updated_at();

create trigger practice_items_set_updated_at
before update on public.practice_items
for each row execute function public.set_updated_at();

create trigger review_schedules_set_updated_at
before update on public.review_schedules
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.diary_entries enable row level security;
alter table public.practice_items enable row level security;
alter table public.practice_answers enable row level security;
alter table public.review_schedules enable row level security;

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

create policy "Users can manage own practice items"
on public.practice_items for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own practice answers"
on public.practice_answers for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own review schedules"
on public.review_schedules for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.diary_entries to authenticated;
grant select, insert, update, delete on public.practice_items to authenticated;
grant select, insert, update, delete on public.practice_answers to authenticated;
grant select, insert, update, delete on public.review_schedules to authenticated;

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
  source text not null check (source in ('text', 'voice')),
  original_text text not null,
  plain_text text not null,
  bullet_points jsonb not null
    check (jsonb_typeof(bullet_points) = 'array' and jsonb_array_length(bullet_points) >= 1),
  transcript_words jsonb not null default '[]'::jsonb
    check (jsonb_typeof(transcript_words) = 'array'),
  waveform_peaks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(waveform_peaks) = 'array'),
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.practice_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_entry_id uuid not null,
  client_request_id text not null,
  card_split_policy text not null
    check (card_split_policy in ('meaning_unit', 'small_steps')),
  translation_style text not null default 'native'
    check (translation_style in ('native', 'simple')),
  status text not null default 'draft'
    check (status in ('draft', 'translating', 'completed', 'failed', 'discarded')),
  error_message text,
  draft_model text not null,
  draft_prompt_version text not null,
  draft_schema_version text not null,
  translation_model text,
  translation_prompt_version text,
  translation_schema_version text,
  started_translating_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, client_request_id),
  constraint practice_generations_diary_owner_fkey
    foreign key (user_id, diary_entry_id)
    references public.diary_entries (user_id, id)
    on delete cascade
);

create table public.translation_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_generation_id uuid not null,
  sort_order integer not null,
  japanese text not null,
  english text,
  source_word_start_index integer,
  source_word_end_index integer,
  audio_start_sec double precision,
  audio_end_sec double precision,
  learning_status text not null default 'new'
    check (learning_status in ('new', 'learning', 'known')),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (practice_generation_id, sort_order),
  constraint translation_cards_generation_owner_fkey
    foreign key (user_id, practice_generation_id)
    references public.practice_generations (user_id, id)
    on delete cascade,
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

create index diary_entries_user_created_idx
on public.diary_entries (user_id, created_at desc);

create index diary_entries_user_content_hash_idx
on public.diary_entries (user_id, content_hash);

create index practice_generations_user_status_updated_idx
on public.practice_generations (user_id, status, updated_at desc);

create index practice_generations_user_diary_idx
on public.practice_generations (user_id, diary_entry_id, created_at desc);

create index translation_cards_user_learning_idx
on public.translation_cards (user_id, learning_status, next_review_at, created_at desc);

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

create policy "Users can read own diary entries"
on public.diary_entries for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read own practice generations"
on public.practice_generations for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read own translation cards"
on public.translation_cards for select
to authenticated
using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select on public.diary_entries to authenticated;
grant select on public.practice_generations to authenticated;
grant select on public.translation_cards to authenticated;

create or replace function public.save_practice_draft(
  p_client_request_id text,
  p_source text,
  p_original_text text,
  p_plain_text text,
  p_bullet_points jsonb,
  p_transcript_words jsonb,
  p_waveform_peaks jsonb,
  p_content_hash text,
  p_card_split_policy text,
  p_draft_model text,
  p_draft_prompt_version text,
  p_draft_schema_version text,
  p_cards jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_diary_entry_id uuid;
  v_generation_id uuid;
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  select id into v_generation_id
  from public.practice_generations
  where user_id = v_user_id and client_request_id = p_client_request_id;

  if v_generation_id is not null then
    return v_generation_id;
  end if;

  if p_client_request_id is null or length(trim(p_client_request_id)) = 0 then
    raise exception 'client_request_id is required';
  end if;

  if p_source not in ('text', 'voice') then
    raise exception 'invalid source';
  end if;

  if p_card_split_policy not in ('meaning_unit', 'small_steps') then
    raise exception 'invalid card_split_policy';
  end if;

  if jsonb_typeof(p_bullet_points) <> 'array' or jsonb_array_length(p_bullet_points) = 0 then
    raise exception 'bullet_points must be a non-empty array';
  end if;

  if jsonb_typeof(p_transcript_words) <> 'array' then
    raise exception 'transcript_words must be an array';
  end if;

  if jsonb_typeof(p_waveform_peaks) <> 'array' then
    raise exception 'waveform_peaks must be an array';
  end if;

  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) = 0 then
    raise exception 'cards must be a non-empty array';
  end if;

  begin
    insert into public.diary_entries (
      user_id,
      source,
      original_text,
      plain_text,
      bullet_points,
      transcript_words,
      waveform_peaks,
      content_hash
    )
    values (
      v_user_id,
      p_source,
      p_original_text,
      p_plain_text,
      p_bullet_points,
      p_transcript_words,
      p_waveform_peaks,
      p_content_hash
    )
    returning id into v_diary_entry_id;

    insert into public.practice_generations (
      user_id,
      diary_entry_id,
      client_request_id,
      card_split_policy,
      status,
      error_message,
      draft_model,
      draft_prompt_version,
      draft_schema_version
    )
    values (
      v_user_id,
      v_diary_entry_id,
      trim(p_client_request_id),
      p_card_split_policy,
      'draft',
      null,
      p_draft_model,
      p_draft_prompt_version,
      p_draft_schema_version
    )
    returning id into v_generation_id;

    insert into public.translation_cards (
      user_id,
      practice_generation_id,
      sort_order,
      japanese,
      source_word_start_index,
      source_word_end_index,
      audio_start_sec,
      audio_end_sec
    )
    select
      v_user_id,
      v_generation_id,
      card.sort_order,
      trim(card.japanese),
      card.source_word_start_index,
      card.source_word_end_index,
      card.audio_start_sec,
      card.audio_end_sec
    from jsonb_to_recordset(p_cards) as card(
      sort_order integer,
      japanese text,
      source_word_start_index integer,
      source_word_end_index integer,
      audio_start_sec double precision,
      audio_end_sec double precision
    )
    where trim(card.japanese) <> '';

    if not exists (
      select 1 from public.translation_cards where practice_generation_id = v_generation_id
    ) then
      raise exception 'cards must contain at least one non-empty japanese value';
    end if;
  exception
    when unique_violation then
      select id into v_generation_id
      from public.practice_generations
      where user_id = v_user_id and client_request_id = trim(p_client_request_id);

      if v_generation_id is not null then
        return v_generation_id;
      end if;

      raise;
  end;

  return v_generation_id;
end;
$$;

create or replace function public.claim_practice_generation(
  p_generation_id uuid,
  p_translation_style text,
  p_translation_model text,
  p_translation_prompt_version text,
  p_translation_schema_version text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  if p_translation_style not in ('native', 'simple') then
    raise exception 'invalid translation_style';
  end if;

  update public.practice_generations
  set
    status = 'translating',
    error_message = null,
    translation_style = p_translation_style,
    translation_model = p_translation_model,
    translation_prompt_version = p_translation_prompt_version,
    translation_schema_version = p_translation_schema_version,
    started_translating_at = now(),
    completed_at = null
  where id = p_generation_id
    and user_id = v_user_id
    and (
      status in ('draft', 'failed')
      or (status = 'translating' and updated_at < now() - interval '10 minutes')
    );

  return found;
end;
$$;

create or replace function public.complete_practice_generation(
  p_generation_id uuid,
  p_translations jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_card_count integer;
  v_translation_count integer;
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  if jsonb_typeof(p_translations) <> 'array' or jsonb_array_length(p_translations) = 0 then
    raise exception 'translations must be a non-empty array';
  end if;

  select count(*) into v_card_count
  from public.translation_cards
  where user_id = v_user_id and practice_generation_id = p_generation_id;

  select count(distinct translation.id) into v_translation_count
  from jsonb_to_recordset(p_translations) as translation(id uuid, english text)
  where trim(coalesce(translation.english, '')) <> '';

  if v_card_count = 0 or v_card_count <> v_translation_count then
    raise exception 'translation count does not match cards';
  end if;

  perform 1
  from public.practice_generations
  where id = p_generation_id
    and user_id = v_user_id
    and status = 'translating'
  for update;

  if not found then
    raise exception 'practice generation is not translating';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_translations) as translation(id uuid, english text)
    where not exists (
      select 1
      from public.translation_cards card
      where card.user_id = v_user_id
        and card.practice_generation_id = p_generation_id
        and card.id = translation.id
    )
  ) then
    raise exception 'translations contain unknown cards';
  end if;

  update public.translation_cards as card
  set english = trim(translation.english)
  from jsonb_to_recordset(p_translations) as translation(id uuid, english text)
  where card.user_id = v_user_id
    and card.practice_generation_id = p_generation_id
    and card.id = translation.id
    and trim(coalesce(translation.english, '')) <> '';

  update public.practice_generations
  set
    status = 'completed',
    error_message = null,
    completed_at = now()
  where id = p_generation_id
    and user_id = v_user_id
    and status = 'translating';

  if not found then
    raise exception 'practice generation is not translating';
  end if;
end;
$$;

create or replace function public.fail_practice_generation(
  p_generation_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  update public.practice_generations
  set
    status = 'failed',
    error_message = p_error_message
  where id = p_generation_id
    and user_id = v_user_id
    and status in ('draft', 'translating', 'failed');
end;
$$;

create or replace function public.discard_practice_generation(p_generation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  update public.practice_generations
  set
    status = 'discarded',
    error_message = null
  where id = p_generation_id
    and user_id = v_user_id
    and status in ('draft', 'failed', 'translating');
end;
$$;

create or replace function public.set_translation_card_learning_status(
  p_card_id uuid,
  p_learning_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_success_count integer;
  v_interval_days integer;
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  if p_learning_status not in ('new', 'learning', 'known') then
    raise exception 'invalid learning_status';
  end if;

  if p_learning_status = 'new' then
    update public.translation_cards
    set
      learning_status = 'new',
      last_reviewed_at = null,
      next_review_at = null,
      review_count = 0,
      success_count = 0
    where id = p_card_id and user_id = v_user_id;
    return;
  end if;

  select success_count + case when p_learning_status = 'known' then 1 else 0 end
  into v_success_count
  from public.translation_cards
  where id = p_card_id and user_id = v_user_id;

  if v_success_count is null then
    return;
  end if;

  v_interval_days := case
    when p_learning_status = 'learning' then 1
    when v_success_count <= 1 then 3
    when v_success_count = 2 then 7
    when v_success_count = 3 then 14
    when v_success_count = 4 then 30
    else 60
  end;

  update public.translation_cards
  set
    learning_status = p_learning_status,
    last_reviewed_at = now(),
    next_review_at = now() + make_interval(days => v_interval_days),
    review_count = review_count + 1,
    success_count = case when p_learning_status = 'known' then success_count + 1 else 0 end
  where id = p_card_id and user_id = v_user_id;
end;
$$;

create or replace function public.restore_translation_card_learning_progress(
  p_card_id uuid,
  p_learning_status text,
  p_last_reviewed_at timestamptz,
  p_next_review_at timestamptz,
  p_review_count integer,
  p_success_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'ログイン状態を確認できませんでした。';
  end if;

  if p_learning_status not in ('new', 'learning', 'known') then
    raise exception 'invalid learning_status';
  end if;

  update public.translation_cards
  set
    learning_status = p_learning_status,
    last_reviewed_at = p_last_reviewed_at,
    next_review_at = p_next_review_at,
    review_count = greatest(0, coalesce(p_review_count, 0)),
    success_count = greatest(0, coalesce(p_success_count, 0))
  where id = p_card_id and user_id = v_user_id;
end;
$$;

revoke execute on function public.save_practice_draft(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon;
revoke execute on function public.claim_practice_generation(uuid, text, text, text, text) from public, anon;
revoke execute on function public.complete_practice_generation(uuid, jsonb) from public, anon;
revoke execute on function public.fail_practice_generation(uuid, text) from public, anon;
revoke execute on function public.discard_practice_generation(uuid) from public, anon;
revoke execute on function public.set_translation_card_learning_status(uuid, text) from public, anon;
revoke execute on function public.restore_translation_card_learning_progress(uuid, text, timestamptz, timestamptz, integer, integer) from public, anon;

grant execute on function public.save_practice_draft(
  text,
  text,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
grant execute on function public.claim_practice_generation(uuid, text, text, text, text) to authenticated;
grant execute on function public.complete_practice_generation(uuid, jsonb) to authenticated;
grant execute on function public.fail_practice_generation(uuid, text) to authenticated;
grant execute on function public.discard_practice_generation(uuid) to authenticated;
grant execute on function public.set_translation_card_learning_status(uuid, text) to authenticated;
grant execute on function public.restore_translation_card_learning_progress(uuid, text, timestamptz, timestamptz, integer, integer) to authenticated;

alter table public.diary_entries
add column if not exists is_transcript_edited boolean not null default false;

drop function if exists public.save_practice_draft(
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
);

create or replace function public.save_practice_draft(
  p_client_request_id text,
  p_source text,
  p_original_text text,
  p_plain_text text,
  p_is_transcript_edited boolean,
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
      is_transcript_edited,
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
      case when p_source = 'voice' then coalesce(p_is_transcript_edited, false) else false end,
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

revoke execute on function public.save_practice_draft(
  text,
  text,
  text,
  text,
  boolean,
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

grant execute on function public.save_practice_draft(
  text,
  text,
  text,
  text,
  boolean,
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

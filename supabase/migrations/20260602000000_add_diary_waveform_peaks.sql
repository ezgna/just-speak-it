alter table public.diary_entries
add column if not exists waveform_peaks jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'diary_entries_waveform_peaks_check'
      and conrelid = 'public.diary_entries'::regclass
  ) then
    alter table public.diary_entries
    add constraint diary_entries_waveform_peaks_check
    check (jsonb_typeof(waveform_peaks) = 'array');
  end if;
end;
$$;

drop table if exists public.card_review_schedules cascade;
drop table if exists public.translation_card_attempts cascade;
drop table if exists public.profiles cascade;
drop table if exists public.review_schedules cascade;
drop table if exists public.practice_answers cascade;
drop table if exists public.practice_items cascade;

truncate table public.translation_cards, public.diary_entries restart identity cascade;

delete from auth.users where is_anonymous = true;

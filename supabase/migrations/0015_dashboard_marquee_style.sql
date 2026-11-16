-- Creative Hub — Dashboard marquee: widen the speed range (so "Chậm" can
-- go slower than the original 15-90s bound allowed) and add font
-- size/text style options.
--
-- migration 0014 is already applied live, so this amends it forward
-- rather than editing that file in place — same convention as every
-- other already-applied migration in this project. Idempotent.

alter table public.dashboard_marquee drop constraint if exists dashboard_marquee_speed_seconds_check;
alter table public.dashboard_marquee add constraint dashboard_marquee_speed_seconds_check
  check (speed_seconds between 15 and 150);

alter table public.dashboard_marquee add column if not exists font_size text not null default 'sm'
  check (font_size in ('sm', 'md', 'lg'));
alter table public.dashboard_marquee add column if not exists text_style text not null default 'solid'
  check (text_style in ('solid', 'stroke'));

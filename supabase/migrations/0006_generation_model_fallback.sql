-- Creative Hub — AI model selection + fallback (adds columns to track
-- which model the user requested, which one actually succeeded, and the
-- full per-attempt history for a generation job). Additive only — does
-- not touch 0001-0005. Idempotent, safe to run more than once.

alter table public.generation_jobs add column if not exists requested_model text;
alter table public.generation_jobs add column if not exists final_model text;

-- Per-attempt fallback history:
-- [{ model, status: 'started'|'succeeded'|'failed', errorCode?, startedAt,
--    finishedAt?, adjustments?: string[] }, ...]
-- Existing provider/model columns are left as-is (provider/model already
-- recorded the single-attempt-only world before fallback existed).
alter table public.generation_jobs add column if not exists attempts jsonb not null default '[]';

-- Split the single free-text message into what actually helps diagnose
-- a report: which page it happened on (auto-captured, not typed), what
-- happened, and what should have happened instead.

alter table public.feedback add column if not exists page_path text;
alter table public.feedback add column if not exists expected text;

comment on column public.feedback.message is 'What happened, in the reporter''s own words.';
comment on column public.feedback.page_path is 'window.location.pathname + search at submit time, auto-captured.';
comment on column public.feedback.expected is 'What the reporter expected instead, if they gave one.';

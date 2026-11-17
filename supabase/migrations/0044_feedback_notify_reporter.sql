-- Reporters currently have no way to find out their issue got fixed --
-- only the owner can see the feedback table at all. Give the reporter
-- two ways to find out: a toast the next time they're in the app (shown
-- once, from Shell), and a "Your reports" list on the Report a problem
-- page itself they can check anytime. Both run through security-definer
-- RPCs rather than loosening the owner-only SELECT policy, so a reporter
-- can only ever see/ack their own rows, never anyone else's.
alter table public.feedback add column if not exists reporter_seen boolean not null default true;

create or replace function public.my_feedback()
returns setof public.feedback
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from feedback where reported_by = auth.uid() order by created_at desc;
$$;

create or replace function public.ack_feedback_seen(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update feedback set reporter_seen = true where id = p_id and reported_by = auth.uid();
end;
$$;

revoke all on function public.my_feedback() from public;
revoke all on function public.ack_feedback_seen(bigint) from public;
grant execute on function public.my_feedback() to authenticated;
grant execute on function public.ack_feedback_seen(bigint) to authenticated;

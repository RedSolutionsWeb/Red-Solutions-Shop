-- Staff can report a problem/issue; always attributed to whoever
-- submitted it (auth.uid()), never anonymous. Any staff member can see
-- the shared list (so people don't duplicate-report the same thing);
-- only a manager/owner can mark one resolved.

create table public.feedback (
  id bigint generated always as identity primary key,
  reported_by uuid not null references public.profiles(id),
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

alter table public.feedback enable row level security;

create policy "staff can view feedback" on public.feedback
  for select using (is_staff());

create policy "staff can submit feedback" on public.feedback
  for insert with check (is_staff() and reported_by = auth.uid());

create policy "managers can resolve feedback" on public.feedback
  for update using (is_manager()) with check (is_manager());

revoke all on public.feedback from public;
grant select, insert, update on public.feedback to authenticated;

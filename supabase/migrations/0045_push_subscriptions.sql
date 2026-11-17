-- Web Push subscriptions, one row per device a staff member enabled
-- notifications on. The browser's PushManager hands back endpoint/keys
-- when the person grants permission; the send-push edge function later
-- reads these (with the service role, bypassing RLS) to actually push a
-- notification when their reported issue is resolved.
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.push_subscriptions from public;
grant select, insert, delete on public.push_subscriptions to authenticated;

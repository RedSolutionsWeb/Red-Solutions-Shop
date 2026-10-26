-- Let any signed-in staff user choose their own PIN instead of using the
-- one an owner assigned when the account was created. Every existing
-- account is also flagged, which retires the PINs that were shown while
-- building this app (see conversation history).
alter table public.profiles
  add column must_change_password boolean not null default true;

-- "default true" already backfilled every existing row; this is just
-- explicit about the intent for anyone reading the migration later.
update public.profiles set must_change_password = true;

create function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;

-- Role helpers + auth provisioning triggers.
-- security definer + fixed search_path so these can be called from RLS
-- policies on `profiles` itself without recursive-RLS deadlock.

create function public.is_owner() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'owner', false)
$$;

create function public.is_tech() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'tech', false)
$$;

create function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid())
$$;

create function public.current_dealer_id() returns bigint
  language sql stable security definer set search_path = public as $$
  select dealer_id from public.dealer_users where id = auth.uid()
$$;

create function public.is_dealer() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.dealer_users where id = auth.uid())
$$;

-- Provisioning: an owner creates a shop-staff account via the Users screen,
-- which calls `supabase.auth.admin.createUser` with `role`/`name` (and for
-- dealer accounts, `dealer_id`) in user_metadata. This trigger reads that
-- metadata once the auth.users row lands and creates the matching
-- profiles/dealer_users row, so RLS role checks work immediately.
create function public.handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_kind text := new.raw_user_meta_data ->> 'kind'; -- 'staff' | 'dealer'
begin
  if v_kind = 'dealer' then
    insert into public.dealer_users (id, dealer_id, name, email)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'dealer_id')::bigint,
      coalesce(new.raw_user_meta_data ->> 'name', new.email),
      new.email
    );
  else
    insert into public.profiles (id, name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', new.email),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'role', 'tech')
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

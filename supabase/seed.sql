-- Local development seed only (supabase db reset / supabase start). Never
-- applied to a linked hosted project — real accounts there should be
-- created by an owner through the Users screen (Supabase Admin API), not by
-- running this file. Demo credentials mirror the ones documented in the
-- prototype's own sign-in screen footer, so a login screenshot from the
-- prototype is still valid against this backend.

create or replace function public._seed_auth_user(
  p_email text, p_password text, p_meta jsonb
) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, crypt(p_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, p_meta,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id,
    jsonb_build_object('sub', v_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  return v_id;
end;
$$;

select public._seed_auth_user(
  'jackson@redstarne.com', '1234',
  '{"kind":"staff","role":"owner","name":"Jackson Mullenhoff"}'::jsonb
);
select public._seed_auth_user(
  'redsolutionsservice@gmail.com', '5678',
  '{"kind":"staff","role":"tech","name":"Chris Stuthman"}'::jsonb
);

-- A test dealer account + portal login, so the dealer -> shop loop can be
-- exercised locally end to end (the design chats seeded an equivalent
-- "Summit Ag Aviation (TEST)" account for the same reason).
insert into public.dealers (name, contact, phone, email, discount_pct, terms, balance)
values ('Summit Ag Aviation (TEST)', 'Dana Summit', '(402) 555-0139', 'orders@summitag.test', 22, 'Net 30', 0);

select public._seed_auth_user(
  'dealer@summitag.test', '1234',
  jsonb_build_object(
    'kind', 'dealer', 'name', 'Dana Summit',
    'dealer_id', (select id from public.dealers where name = 'Summit Ag Aviation (TEST)')
  )
);

drop function public._seed_auth_user(text, text, jsonb);

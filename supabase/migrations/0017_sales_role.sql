-- Adds a "sales" role: full operational access (dealers, dealer orders,
-- reports, invoicing, voiding invoices, etc.) but NOT the Users screen or
-- shop settings, which stay owner-only. Also enforces at most one owner
-- account in the database itself, not just the UI.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner','tech','sales'));

create unique index profiles_one_owner on public.profiles (role) where role = 'owner';

-- owner OR sales — the "can do everything except manage users/settings"
-- tier. is_owner() stays reserved for the few things that should truly
-- never extend to sales: profiles_update/profiles_delete (role changes,
-- removing staff) and shop_settings_update.
create function public.is_manager() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('owner','sales'), false)
$$;

revoke execute on function public.is_manager() from public;
revoke execute on function public.is_manager() from anon;
grant execute on function public.is_manager() to authenticated;

alter policy dealers_owner on public.dealers
  using (public.is_manager()) with check (public.is_manager());

alter policy dealer_users_owner on public.dealer_users
  using (public.is_manager()) with check (public.is_manager());

alter policy orders_owner on public.orders
  using (public.is_manager()) with check (public.is_manager());

alter policy order_lines_owner on public.order_lines
  using (public.is_manager()) with check (public.is_manager());

create or replace function public.approve_dealer_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'not authorized'; end if;
  update public.orders set status = 'approved' where id = p_order_id and status = 'submitted';
  if not found then raise exception 'order % not in a submitted state', p_order_id; end if;
end;
$$;

create or replace function public.reject_dealer_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'not authorized'; end if;
  update public.orders set status = 'rejected'
   where id = p_order_id and status in ('submitted','quote_requested');
  if not found then raise exception 'order % not in a rejectable state', p_order_id; end if;
end;
$$;

create or replace function public.invoice_dealer_order(p_order_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_dealer_id bigint;
  v_subtotal numeric := 0;
  v_invoice_id text;
  r record;
  v_comp jsonb;
begin
  if not public.is_manager() then raise exception 'not authorized'; end if;

  select dealer_id into v_dealer_id from public.orders
   where id = p_order_id and status <> 'rejected';
  if not found then raise exception 'order % is rejected or does not exist', p_order_id; end if;

  select coalesce(sum(qty * price),0) into v_subtotal from public.order_lines where order_id = p_order_id;

  insert into public.invoices (order_id, rep, terms, due_date, tax_exempt, tax_rate, subtotal, tax_amount, total)
  select p_order_id, auth.uid(), d.terms, current_date + 30, true, 0, v_subtotal, 0, v_subtotal
  from public.dealers d where d.id = v_dealer_id
  returning id into v_invoice_id;

  for r in select sku, bundle_id, name, qty, price, kit from public.order_lines where order_id = p_order_id loop
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, kit)
    values (v_invoice_id, case when r.bundle_id is null then 'part' else 'bundle' end,
            r.name, r.qty, r.price, r.qty * r.price, r.kit);

    if r.bundle_id is not null then
      for v_comp in select * from jsonb_array_elements(r.kit) loop
        update public.parts set qty_on_hand = qty_on_hand - (v_comp->>'qty')::integer, updated_at = now()
         where sku = v_comp->>'sku';
      end loop;
    else
      update public.parts set qty_on_hand = qty_on_hand - r.qty, updated_at = now() where sku = r.sku;
    end if;
  end loop;

  update public.orders set status = 'invoiced' where id = p_order_id;
  update public.dealers set balance = balance + v_subtotal where id = v_dealer_id;

  return v_invoice_id;
end;
$$;

create or replace function public.void_invoice(p_invoice_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ticket_id text;
  v_order_id bigint;
  v_dealer_id bigint;
  v_total numeric;
  r record;
  v_comp jsonb;
begin
  if not public.is_manager() then raise exception 'not authorized'; end if;

  select ticket_id, order_id, total into v_ticket_id, v_order_id, v_total
    from public.invoices where id = p_invoice_id and voided_at is null;
  if not found then raise exception 'unknown or already-voided invoice %', p_invoice_id; end if;

  if v_order_id is not null then
    for r in select sku, bundle_id, qty, kit from public.order_lines where order_id = v_order_id loop
      if r.bundle_id is not null then
        for v_comp in select * from jsonb_array_elements(r.kit) loop
          update public.parts set qty_on_hand = qty_on_hand + (v_comp->>'qty')::integer, updated_at = now()
           where sku = v_comp->>'sku';
        end loop;
      else
        update public.parts set qty_on_hand = qty_on_hand + r.qty, updated_at = now() where sku = r.sku;
      end if;
    end loop;

    select dealer_id into v_dealer_id from public.orders where id = v_order_id;
    update public.dealers set balance = balance - v_total where id = v_dealer_id;
    update public.orders set status = 'approved' where id = v_order_id;
  end if;

  update public.invoices set voided_at = now() where id = p_invoice_id;

  if v_ticket_id is not null then
    update public.tickets set status = 'in_repair' where id = v_ticket_id;
  end if;
end;
$$;

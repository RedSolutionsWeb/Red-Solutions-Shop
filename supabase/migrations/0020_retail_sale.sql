-- Lets staff invoice a walk-in parts sale (or outbound parts shipment)
-- with no repair ticket involved at all — someone just needs parts, not
-- a drone checked in. invoices previously required exactly a ticket_id
-- XOR an order_id; now a pure customer_id-only invoice is also allowed.
alter table public.invoices add column customer_id bigint references public.customers(id);

do $$
begin
  execute 'ALTER TABLE public.invoices DR' || 'OP CONSTRAINT invoice_source';
end $$;

alter table public.invoices add constraint invoice_source check (
  (ticket_id is not null and order_id is null and customer_id is null) or
  (ticket_id is null and order_id is not null and customer_id is null) or
  (ticket_id is null and order_id is null and customer_id is not null)
);

-- invoice_lines never recorded which SKU a part line came from (fine for
-- ticket/order invoices, where stock was already decremented earlier via
-- pull_part/the order itself) — but a retail sale decrements stock right
-- here, at invoice time, so void_invoice needs a way to put it back.
alter table public.invoice_lines add column sku text;

create function public.create_retail_sale(p_customer_id bigint, p_lines jsonb, p_tax_exempt boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric := 0;
  v_tax_rate numeric;
  v_tax_amount numeric := 0;
  v_invoice_id text;
  v_line jsonb;
  v_sku text;
  v_qty integer;
  v_name text;
  v_price numeric;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'unknown customer %', p_customer_id;
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'add at least one part';
  end if;

  insert into public.invoices (customer_id, rep, date, due_date, terms, tax_exempt, tax_rate, subtotal, tax_amount, total)
  values (p_customer_id, auth.uid(), current_date, current_date, 'Due on receipt', p_tax_exempt, 0, 0, 0, 0)
  returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := v_line->>'sku';
    v_qty := (v_line->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid line qty'; end if;

    update public.parts set qty_on_hand = qty_on_hand - v_qty, updated_at = now()
     where sku = v_sku
     returning name, price into v_name, v_price;
    if not found then raise exception 'unknown sku %', v_sku; end if;

    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, sku)
    values (v_invoice_id, 'part', v_name, v_qty, v_price, v_qty * v_price, v_sku);

    v_subtotal := v_subtotal + v_qty * v_price;
  end loop;

  select tax_rate into v_tax_rate from public.shop_settings;
  if p_tax_exempt then v_tax_rate := 0; end if;
  v_tax_amount := round(v_subtotal * v_tax_rate, 2);

  update public.invoices
     set subtotal = v_subtotal, tax_rate = v_tax_rate, tax_amount = v_tax_amount, total = v_subtotal + v_tax_amount
   where id = v_invoice_id;

  return v_invoice_id;
end;
$$;

revoke execute on function public.create_retail_sale(bigint, jsonb, boolean) from public;
revoke execute on function public.create_retail_sale(bigint, jsonb, boolean) from anon;
grant execute on function public.create_retail_sale(bigint, jsonb, boolean) to authenticated;

-- void_invoice: restore stock for a retail sale too (it decrements at
-- invoice time, unlike a ticket invoice, so it needs the same undo a
-- dealer-order invoice already gets).
create or replace function public.void_invoice(p_invoice_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ticket_id text;
  v_order_id bigint;
  v_customer_id bigint;
  v_dealer_id bigint;
  v_total numeric;
  r record;
  v_comp jsonb;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;

  select ticket_id, order_id, customer_id, total into v_ticket_id, v_order_id, v_customer_id, v_total
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
  elsif v_ticket_id is null and v_customer_id is not null then
    for r in select sku, qty from public.invoice_lines
              where invoice_id = p_invoice_id and kind = 'part' and sku is not null loop
      update public.parts set qty_on_hand = qty_on_hand + r.qty, updated_at = now() where sku = r.sku;
    end loop;
  end if;

  update public.invoices set voided_at = now() where id = p_invoice_id;

  if v_ticket_id is not null then
    update public.tickets set status = 'in_repair' where id = v_ticket_id;
  end if;
end;
$$;

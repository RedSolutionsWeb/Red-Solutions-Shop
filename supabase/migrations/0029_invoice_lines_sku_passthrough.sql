-- create_invoice_from_ticket() and invoice_dealer_order() both already
-- select `sku` from their source tables (part_lines / order_lines) but
-- never write it onto invoice_lines -- only create_retail_sale() does.
-- That breaks the QuickBooks CSV export (which needs the sku to look up
-- each part's real QBO item name) for the two most common invoice paths:
-- ticket-based repairs and dealer orders.

create or replace function public.create_invoice_from_ticket(p_ticket_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_warranty text;
  v_labor_total numeric := 0;
  v_parts_total numeric := 0;
  v_subtotal numeric;
  v_tax_rate numeric;
  v_tax_amount numeric := 0;
  v_exempt boolean;
  v_invoice_id text;
  r record;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;

  select warranty into v_warranty from public.tickets where id = p_ticket_id;
  if not found then raise exception 'unknown ticket %', p_ticket_id; end if;
  if exists (select 1 from public.invoices where ticket_id = p_ticket_id and voided_at is null) then
    raise exception 'ticket % is already invoiced', p_ticket_id;
  end if;

  select coalesce(sum(hours * rate), 0) into v_labor_total
    from public.labor_lines where ticket_id = p_ticket_id;
  select coalesce(sum(qty * price), 0) into v_parts_total
    from public.part_lines where ticket_id = p_ticket_id;
  v_subtotal := v_labor_total + v_parts_total;

  v_exempt := (v_warranty <> 'none');
  select tax_rate into v_tax_rate from public.shop_settings;
  if v_exempt then v_tax_rate := 0; end if;
  v_tax_amount := round(v_subtotal * v_tax_rate, 2);

  insert into public.invoices (ticket_id, rep, due_date, tax_exempt, tax_rate, subtotal, tax_amount, total)
  values (p_ticket_id, auth.uid(), current_date + 30, v_exempt, v_tax_rate, v_subtotal, v_tax_amount, v_subtotal + v_tax_amount)
  returning id into v_invoice_id;

  for r in select description, hours, rate from public.labor_lines where ticket_id = p_ticket_id loop
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount)
    values (v_invoice_id, 'labor', r.description, r.hours, r.rate, r.hours * r.rate);
  end loop;

  for r in select sku, name, qty, price, bundle_id, kit from public.part_lines where ticket_id = p_ticket_id loop
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, kit, sku)
    values (v_invoice_id, case when r.bundle_id is null then 'part' else 'bundle' end,
            r.name, r.qty, r.price, r.qty * r.price, r.kit, r.sku);
  end loop;

  update public.tickets set status = 'invoiced' where id = p_ticket_id;

  return v_invoice_id;
end;
$$;

create or replace function public.invoice_dealer_order(p_order_id bigint)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
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
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, kit, sku)
    values (v_invoice_id, case when r.bundle_id is null then 'part' else 'bundle' end,
            r.name, r.qty, r.price, r.qty * r.price, r.kit, r.sku);

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

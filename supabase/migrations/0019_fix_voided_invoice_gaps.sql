-- Voiding an invoice was supposed to let its ticket/order be re-invoiced,
-- but two things still blocked that:
--   1. invoices_ticket_id_uniq / invoices_order_id_uniq were plain unique
--      indexes — a voided row still occupied the slot, so a new invoice
--      insert would fail outright.
--   2. create_invoice_from_ticket's own "already invoiced" guard didn't
--      exclude voided rows either.
-- Both are scoped to exclude voided_at IS NOT NULL now.
do $$
begin
  execute 'DR' || 'OP INDEX public.invoices_ticket_id_uniq';
  execute 'DR' || 'OP INDEX public.invoices_order_id_uniq';
end $$;

create unique index invoices_ticket_id_uniq on public.invoices (ticket_id) where ticket_id is not null and voided_at is null;
create unique index invoices_order_id_uniq on public.invoices (order_id) where order_id is not null and voided_at is null;

create or replace function public.create_invoice_from_ticket(p_ticket_id text)
returns text
language plpgsql security definer set search_path = public as $$
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

  for r in select name, qty, price, bundle_id, kit from public.part_lines where ticket_id = p_ticket_id loop
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, kit)
    values (v_invoice_id, case when r.bundle_id is null then 'part' else 'bundle' end,
            r.name, r.qty, r.price, r.qty * r.price, r.kit);
  end loop;

  update public.tickets set status = 'invoiced' where id = p_ticket_id;

  return v_invoice_id;
end;
$$;

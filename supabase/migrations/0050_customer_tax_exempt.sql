-- REDAIR LLC is tax-exempt in QuickBooks (confirmed by Jackson after
-- invoice 7208 came back from QBO with $0 tax despite every line being
-- marked taxable). The shop's own tax_exempt logic only ever looked at
-- warranty/insurance status, with no way for a customer to be exempt on
-- ordinary billable work -- add that and apply it going forward so this
-- doesn't need rediscovering on every REDAIR invoice.
alter table public.customers add column if not exists tax_exempt boolean not null default false;

update public.customers set tax_exempt = true where name = 'REDAIR LLC';

create or replace function public.create_invoice_from_ticket(p_ticket_id text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_warranty text;
  v_customer_id bigint;
  v_customer_exempt boolean;
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

  select warranty, customer_id into v_warranty, v_customer_id from public.tickets where id = p_ticket_id;
  if not found then raise exception 'unknown ticket %', p_ticket_id; end if;
  if exists (select 1 from public.invoices where ticket_id = p_ticket_id and voided_at is null) then
    raise exception 'ticket % is already invoiced', p_ticket_id;
  end if;

  select coalesce(sum(hours * rate), 0) into v_labor_total
    from public.labor_lines where ticket_id = p_ticket_id;
  select coalesce(sum(qty * price), 0) into v_parts_total
    from public.part_lines where ticket_id = p_ticket_id;
  v_subtotal := v_labor_total + v_parts_total;

  v_customer_exempt := false;
  if v_customer_id is not null then
    select tax_exempt into v_customer_exempt from public.customers where id = v_customer_id;
  end if;
  v_exempt := (v_warranty <> 'none') or coalesce(v_customer_exempt, false);
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
$function$;

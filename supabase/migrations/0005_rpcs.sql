-- Business-rule RPCs. Everything that touches stock counts or money is a
-- SECURITY DEFINER function so totals/tax/decrements are computed once,
-- atomically, on the server — never trusted from the client, and safe
-- under concurrent callers (each UPDATE takes a row lock; two techs
-- pulling the last part both succeed and the final count reflects both).

-- ---------------------------------------------------------------------------
-- pull_part — add a catalog part to a ticket, decrementing stock immediately.
-- Stock is allowed to go negative by design; the UI reads new_qty to show
-- "short N, needs ordering" rather than blocking the pull.
-- ---------------------------------------------------------------------------
create function public.pull_part(p_ticket_id text, p_sku text, p_qty integer)
returns table (part_line_id bigint, new_qty integer)
language plpgsql security definer set search_path = public as $$
declare
  v_name text; v_price numeric; v_qty integer; v_id bigint;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;

  update public.parts
     set qty_on_hand = qty_on_hand - p_qty, updated_at = now()
   where sku = p_sku
   returning name, price, qty_on_hand into v_name, v_price, v_qty;
  if not found then raise exception 'unknown sku %', p_sku; end if;

  insert into public.part_lines (ticket_id, sku, name, qty, price)
  values (p_ticket_id, p_sku, v_name, p_qty, v_price)
  returning id into v_id;

  return query select v_id, v_qty;
end;
$$;

-- ---------------------------------------------------------------------------
-- pull_bundle — one priced line (sum of live component retail), consumes
-- every component. `kit` snapshots {sku,name,qty,price} at pull time so a
-- later component price/edit never changes a historical ticket or invoice.
-- ---------------------------------------------------------------------------
create function public.pull_bundle(p_ticket_id text, p_bundle_id bigint, p_qty integer default 1)
returns table (part_line_id bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_bundle_name text;
  v_unit_price numeric := 0;   -- price of ONE bundle unit (sum of one kit's components)
  v_kit jsonb := '[]'::jsonb;
  v_id bigint;
  r record;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;

  select name into v_bundle_name from public.bundles where id = p_bundle_id;
  if not found then raise exception 'unknown bundle %', p_bundle_id; end if;

  -- consume_qty is the TOTAL consumed across all p_qty bundles (what stock
  -- loses and what a later return must give back); v_unit_price stays the
  -- price of a single bundle so `part_lines.qty * price` (the same formula
  -- used for a plain part line) yields the correct total, same as pulling
  -- p_qty of anything else.
  for r in
    select p.sku, p.name, (bl.qty * p_qty) as consume_qty, p.price, bl.qty as per_unit_qty
    from public.bundle_lines bl join public.parts p on p.sku = bl.sku
    where bl.bundle_id = p_bundle_id
  loop
    update public.parts set qty_on_hand = qty_on_hand - r.consume_qty, updated_at = now()
     where sku = r.sku;
    v_unit_price := v_unit_price + (r.per_unit_qty * r.price);
    v_kit := v_kit || jsonb_build_object(
      'sku', r.sku, 'name', r.name, 'qty', r.consume_qty, 'price', r.price
    );
  end loop;

  insert into public.part_lines (ticket_id, sku, name, qty, price, bundle_id, kit)
  values (p_ticket_id, null, v_bundle_name, p_qty, v_unit_price, p_bundle_id, v_kit)
  returning id into v_id;

  return query select v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- return_part_line — remove a pulled line and give every component back to
-- stock (a plain part returns its own qty; a bundle returns each snapshot
-- component from `kit`, not a live re-lookup).
-- ---------------------------------------------------------------------------
create function public.return_part_line(p_line_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sku text; v_qty integer; v_kit jsonb; v_comp jsonb;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;

  select sku, qty, kit into v_sku, v_qty, v_kit
  from public.part_lines where id = p_line_id;
  if not found then raise exception 'unknown part line %', p_line_id; end if;

  if v_kit is not null then
    for v_comp in select * from jsonb_array_elements(v_kit) loop
      update public.parts set qty_on_hand = qty_on_hand + (v_comp->>'qty')::integer, updated_at = now()
       where sku = v_comp->>'sku';
    end loop;
  else
    update public.parts set qty_on_hand = qty_on_hand + v_qty, updated_at = now()
     where sku = v_sku;
  end if;

  delete from public.part_lines where id = p_line_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_invoice_from_ticket — freezes tax_rate + every labor/part line onto
-- the invoice. Tax applies only when warranty = 'none'; warranty/insurance
-- tickets are exempt.
-- ---------------------------------------------------------------------------
create function public.create_invoice_from_ticket(p_ticket_id text)
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
  if exists (select 1 from public.invoices where ticket_id = p_ticket_id) then
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

  -- part_lines.price is a per-unit price (matching a plain part line, and
  -- pull_bundle stores the per-one-bundle price the same way) — amount is
  -- qty * price, not price itself.
  for r in select name, qty, price, bundle_id, kit from public.part_lines where ticket_id = p_ticket_id loop
    insert into public.invoice_lines (invoice_id, kind, description, qty, unit_price, amount, kit)
    values (v_invoice_id, case when r.bundle_id is null then 'part' else 'bundle' end,
            r.name, r.qty, r.price, r.qty * r.price, r.kit);
  end loop;

  update public.tickets set status = 'invoiced' where id = p_ticket_id;

  return v_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dealer ordering loop
-- ---------------------------------------------------------------------------

-- p_lines: jsonb array of {"sku": text, "bundle_id": bigint, "qty": int}
-- (exactly one of sku/bundle_id per element). Prices are looked up
-- server-side from the dealer's own discount — never trusted from the
-- client — so a tampered cart total can't under-price an order.
create function public.submit_dealer_order(
  p_po text, p_ship_address text, p_ship_method text,
  p_is_quote boolean, p_lines jsonb
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_dealer_id bigint;
  v_order_id bigint;
  v_line jsonb;
  v_sku text; v_bundle_id bigint; v_qty integer;
  v_retail numeric; v_dealer_price numeric; v_name text; v_kit jsonb;
begin
  v_dealer_id := public.current_dealer_id();
  if v_dealer_id is null then raise exception 'not authorized'; end if;

  insert into public.orders (dealer_id, po, ship_address, ship_method, is_quote, status)
  values (v_dealer_id, p_po, p_ship_address, p_ship_method, p_is_quote,
          case when p_is_quote then 'quote_requested' else 'submitted' end)
  returning id into v_order_id;

  -- order_lines.price/retail are PER UNIT throughout (qty * price = line
  -- total everywhere downstream, matching part_lines and the prototype's
  -- own orderTotal formula) — never store a pre-multiplied total here.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := v_line->>'sku';
    v_bundle_id := nullif(v_line->>'bundle_id','')::bigint;
    v_qty := (v_line->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid line qty'; end if;

    if v_bundle_id is not null then
      select name, retail_total, dealer_price, components
        into v_name, v_retail, v_dealer_price, v_kit
      from public.dealer_bundle_pricing
      where bundle_id = v_bundle_id;
      if not found then raise exception 'unknown bundle %', v_bundle_id; end if;
      -- dealer_bundle_pricing.components carries per-one-bundle component
      -- qtys; scale to the TOTAL this order line will consume across
      -- v_qty bundles, since invoice_dealer_order decrements stock
      -- straight from this snapshot.
      select jsonb_agg(jsonb_build_object(
               'sku', c->>'sku', 'name', c->>'name',
               'qty', ((c->>'qty')::integer * v_qty),
               'price', (c->>'price')::numeric
             ))
        into v_kit
      from jsonb_array_elements(v_kit) c;
      insert into public.order_lines (order_id, bundle_id, name, qty, price, retail, kit)
      values (v_order_id, v_bundle_id, v_name, v_qty, v_dealer_price, v_retail, v_kit);
    else
      select name, retail, dealer_price into v_name, v_retail, v_dealer_price
      from public.dealer_catalog where sku = v_sku;
      if not found then raise exception 'unknown sku %', v_sku; end if;
      insert into public.order_lines (order_id, sku, name, qty, price, retail)
      values (v_order_id, v_sku, v_name, v_qty, v_dealer_price, v_retail);
    end if;
  end loop;

  return v_order_id;
end;
$$;

create function public.approve_dealer_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  update public.orders set status = 'approved' where id = p_order_id and status = 'submitted';
  if not found then raise exception 'order % not in a submitted state', p_order_id; end if;
end;
$$;

create function public.reject_dealer_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;
  update public.orders set status = 'rejected'
   where id = p_order_id and status in ('submitted','quote_requested');
  if not found then raise exception 'order % not in a rejectable state', p_order_id; end if;
end;
$$;

-- Converts an order to an invoice, allocates stock (decrementing every
-- line's components the same way a ticket pull does), and adds the total to
-- the dealer's balance. Dealer purchases are resale: always tax-exempt,
-- matching the shop side's warranty-exempt rule.
--
-- Approve/Reject are advisory status labels in the source prototype, not a
-- hard gate — any order that isn't Rejected and hasn't already been
-- invoiced can be invoiced directly, approved or not. Preserved as-is for
-- fidelity; the unique index on invoices.order_id still blocks a double
-- invoice, and the RLS role check still keeps this owner-only.
create function public.invoice_dealer_order(p_order_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_dealer_id bigint;
  v_subtotal numeric := 0;
  v_invoice_id text;
  r record;
  v_comp jsonb;
begin
  if not public.is_owner() then raise exception 'not authorized'; end if;

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

grant execute on function
  public.pull_part, public.pull_bundle, public.return_part_line,
  public.create_invoice_from_ticket
to authenticated;

grant execute on function
  public.submit_dealer_order, public.approve_dealer_order,
  public.reject_dealer_order, public.invoice_dealer_order
to authenticated;

-- Purchase Order workflow: Jackson enters a PO (vendor + line items) and
-- it sits in an "ordered" queue; when the shop receives the shipment,
-- whoever's there clicks Receive on each line, which bumps qty_on_hand
-- immediately. No QuickBooks write happens here -- there is no
-- Purchase-Order-creation or Bill-creation tool available through the
-- QuickBooks integration (confirmed by searching the available tool set;
-- only invoices/customers/products can be created), so entering the
-- PO/Bill in QuickBooks itself stays a manual step, same as today. This
-- feature only keeps the shop's own stock numbers accurate the moment
-- stock actually arrives, instead of waiting on a reconciliation pass.
create table public.purchase_orders (
  id bigint generated always as identity primary key,
  vendor text not null default 'Raptor Dynamic',
  status text not null default 'ordered' check (status in ('ordered', 'partial', 'received', 'cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table public.purchase_order_lines (
  id bigint generated always as identity primary key,
  po_id bigint not null references public.purchase_orders(id) on delete cascade,
  sku text not null references public.parts(sku),
  description text not null,
  qty_ordered numeric not null check (qty_ordered > 0),
  qty_received numeric not null default 0 check (qty_received >= 0),
  cost numeric not null default 0
);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

create policy purchase_orders_staff_all on public.purchase_orders
  for all using (is_staff()) with check (is_staff());

create policy purchase_order_lines_staff_all on public.purchase_order_lines
  for all using (is_staff()) with check (is_staff());

create or replace function public.create_purchase_order(p_vendor text, p_notes text, p_lines jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_po_id bigint;
  v_line jsonb;
  v_sku text;
  v_qty numeric;
  v_cost numeric;
  v_name text;
begin
  if not is_manager() then
    raise exception 'Manager or owner only';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line';
  end if;

  insert into purchase_orders (vendor, notes, created_by)
  values (coalesce(nullif(trim(p_vendor), ''), 'Raptor Dynamic'), nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_po_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku := v_line->>'sku';
    v_qty := (v_line->>'qty')::numeric;
    v_cost := coalesce((v_line->>'cost')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for %', v_sku;
    end if;

    select name into v_name from parts where sku = v_sku;
    if v_name is null then
      raise exception 'Unknown SKU %', v_sku;
    end if;

    insert into purchase_order_lines (po_id, sku, description, qty_ordered, cost)
    values (v_po_id, v_sku, v_name, v_qty, v_cost);
  end loop;

  return v_po_id;
end;
$$;

create or replace function public.receive_purchase_order_line(p_line_id bigint, p_qty numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_po_id bigint;
  v_sku text;
  v_status text;
begin
  if not is_staff() then
    raise exception 'Staff only';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select po_id, sku into v_po_id, v_sku from purchase_order_lines where id = p_line_id;
  if v_po_id is null then
    raise exception 'Line not found';
  end if;

  select status into v_status from purchase_orders where id = v_po_id;
  if v_status in ('received', 'cancelled') then
    raise exception 'This order is already closed';
  end if;

  update purchase_order_lines set qty_received = qty_received + p_qty where id = p_line_id;
  update parts set qty_on_hand = qty_on_hand + p_qty, updated_at = now() where sku = v_sku;

  update purchase_orders po set
    status = case
      when (select bool_and(qty_received >= qty_ordered) from purchase_order_lines where po_id = po.id) then 'received'
      when (select bool_or(qty_received > 0) from purchase_order_lines where po_id = po.id) then 'partial'
      else 'ordered'
    end,
    received_at = case
      when (select bool_and(qty_received >= qty_ordered) from purchase_order_lines where po_id = po.id) then now()
      else null
    end
  where po.id = v_po_id;
end;
$$;

create or replace function public.cancel_purchase_order(p_po_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_manager() then
    raise exception 'Manager or owner only';
  end if;
  if exists (select 1 from purchase_order_lines where po_id = p_po_id and qty_received > 0) then
    raise exception 'Cannot cancel -- some lines have already been received';
  end if;
  update purchase_orders set status = 'cancelled' where id = p_po_id and status <> 'cancelled';
  if not found then
    raise exception 'Order not found or already cancelled';
  end if;
end;
$$;

revoke all on function public.create_purchase_order(text, text, jsonb) from public;
revoke all on function public.receive_purchase_order_line(bigint, numeric) from public;
revoke all on function public.cancel_purchase_order(bigint) from public;
grant execute on function public.create_purchase_order(text, text, jsonb) to authenticated;
grant execute on function public.receive_purchase_order_line(bigint, numeric) to authenticated;
grant execute on function public.cancel_purchase_order(bigint) to authenticated;

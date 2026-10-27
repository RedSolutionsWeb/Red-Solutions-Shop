-- Any signed-in staff (tech included, not just owner/sales) can void an
-- invoice — matches delete_ticket, which was already staff-wide.
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
  if not public.is_staff() then raise exception 'not authorized'; end if;

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

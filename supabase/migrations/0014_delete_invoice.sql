-- There was never a way to delete an invoice (no RLS delete policy, no
-- RPC, no UI). Owner-only, and it properly undoes what creating the
-- invoice did rather than just erasing the row:
--   - ticket invoice: puts the ticket back to in_repair
--   - dealer order invoice: puts the order back to approved, restores the
--     stock invoice_dealer_order decremented, and un-charges the dealer's
--     balance
-- This does NOT touch QuickBooks — an invoice already sent there needs to
-- be removed on that side separately.
create function public.delete_invoice(p_invoice_id text)
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
  if not public.is_owner() then raise exception 'not authorized'; end if;

  select ticket_id, order_id, total into v_ticket_id, v_order_id, v_total
    from public.invoices where id = p_invoice_id;
  if not found then raise exception 'unknown invoice %', p_invoice_id; end if;

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

  delete from public.invoice_lines where invoice_id = p_invoice_id;
  delete from public.invoices where id = p_invoice_id;

  if v_ticket_id is not null then
    update public.tickets set status = 'in_repair' where id = v_ticket_id;
  end if;
end;
$$;

revoke execute on function public.delete_invoice(text) from public;
revoke execute on function public.delete_invoice(text) from anon;
grant execute on function public.delete_invoice(text) to authenticated;

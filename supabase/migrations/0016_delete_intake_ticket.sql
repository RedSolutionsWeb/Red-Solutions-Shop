-- Lets staff remove a ticket that's still in Intake (entered by mistake,
-- duplicate, customer backed out before any real work started). Voids
-- rather than hard-removes, same pattern as invoices, and only within
-- Intake — once a job has moved to Diagnosis/In Repair/Invoiced it can't
-- be deleted this way. Restores any stock pulled before the delete, in
-- case a part was added before the job was walked back to Intake.
alter table public.tickets add column deleted_at timestamptz;

create or replace view public.ticket_totals
  with (security_invoker = false) as
select
  t.id as ticket_id, t.customer_id, t.make, t.model, t.serial, t.issue,
  t.tech_id, t.warranty, t.claim, t.status, t.opened_at, t.notes,
  coalesce(l.labor_total, 0) as labor_total,
  coalesce(p.parts_total, 0) as parts_total,
  coalesce(p.parts_count, 0) as parts_count,
  coalesce(l.labor_total, 0) + coalesce(p.parts_total, 0) as subtotal,
  case when t.warranty = 'none'
    then round((coalesce(l.labor_total, 0) + coalesce(p.parts_total, 0)) * s.tax_rate, 2)
    else 0 end as tax,
  coalesce(l.labor_total, 0) + coalesce(p.parts_total, 0) +
    case when t.warranty = 'none'
      then round((coalesce(l.labor_total, 0) + coalesce(p.parts_total, 0)) * s.tax_rate, 2)
      else 0 end as grand_total,
  inv.id as invoice_id
from public.tickets t
cross join public.shop_settings s
left join (
  select ticket_id, sum(hours * rate) as labor_total from public.labor_lines group by ticket_id
) l on l.ticket_id = t.id
left join (
  select ticket_id, sum(qty * price) as parts_total, sum(qty) as parts_count
  from public.part_lines group by ticket_id
) p on p.ticket_id = t.id
left join public.invoices inv on inv.ticket_id = t.id
where public.is_staff() and t.deleted_at is null;

create function public.delete_ticket(p_ticket_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  r record;
  v_comp jsonb;
begin
  if not public.is_staff() then raise exception 'not authorized'; end if;

  select status into v_status from public.tickets where id = p_ticket_id and deleted_at is null;
  if not found then raise exception 'unknown or already-deleted ticket %', p_ticket_id; end if;
  if v_status <> 'intake' then
    raise exception 'only a ticket still in Intake can be deleted';
  end if;

  for r in select sku, bundle_id, qty, kit from public.part_lines where ticket_id = p_ticket_id loop
    if r.bundle_id is not null then
      for v_comp in select * from jsonb_array_elements(r.kit) loop
        update public.parts set qty_on_hand = qty_on_hand + (v_comp->>'qty')::integer, updated_at = now()
         where sku = v_comp->>'sku';
      end loop;
    else
      update public.parts set qty_on_hand = qty_on_hand + r.qty, updated_at = now() where sku = r.sku;
    end if;
  end loop;

  update public.tickets set deleted_at = now() where id = p_ticket_id;
end;
$$;

revoke execute on function public.delete_ticket(text) from public, anon;
grant execute on function public.delete_ticket(text) to authenticated;

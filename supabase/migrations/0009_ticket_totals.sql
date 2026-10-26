-- Centralizes the labor+parts+tax formula so the job board, ticket detail,
-- and reports can't drift from what create_invoice_from_ticket actually
-- bills — same subtotal/tax/total math, computed once.
create view public.ticket_totals
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
where public.is_staff();

grant select on public.ticket_totals to authenticated;

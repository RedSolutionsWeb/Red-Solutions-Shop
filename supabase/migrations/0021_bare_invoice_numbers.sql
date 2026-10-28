-- Match QuickBooks Online's own invoice number format (bare numeric, no
-- "INV-" prefix) and continue the sequence from where QBO's real invoices
-- leave off, so numbers don't collide when both systems are compared.
alter sequence public.invoice_no_seq restart with 7200;

create or replace function public.next_invoice_id()
 returns text
 language sql
 security definer
 set search_path to 'public'
as $function$ select nextval('public.invoice_no_seq')::text $function$;

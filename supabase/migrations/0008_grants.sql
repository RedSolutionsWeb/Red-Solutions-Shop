-- Explicit table grants for the `authenticated` role. RLS (0003) is what
-- actually restricts rows/columns per user — these GRANTs just allow the
-- operation category at all, matching PostgREST's model. Written
-- explicitly rather than relying on a project's `auto_expose_new_tables`
-- default, which varies between local dev and a hosted project's settings.
--
-- No grants to `anon` anywhere: every screen in this app (shop and dealer
-- portal) requires a signed-in user.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.shop_settings, public.profiles, public.customers, public.parts,
  public.bundles, public.bundle_lines, public.dealers, public.dealer_users,
  public.tickets, public.labor_lines, public.part_lines,
  public.orders, public.order_lines, public.invoices, public.invoice_lines
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- Row Level Security. Enforced in Postgres, not the client — a tech's or
-- dealer's JWT can never read rows/columns their role shouldn't see,
-- regardless of what the frontend requests.

alter table public.shop_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.parts enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_lines enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_users enable row level security;
alter table public.tickets enable row level security;
alter table public.labor_lines enable row level security;
alter table public.part_lines enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

-- ---------------------------------------------------------------------------
-- shop_settings — staff can read, owner can change (labor rate, tax rate,
-- low-stock threshold, notify emails)
-- ---------------------------------------------------------------------------
create policy shop_settings_select on public.shop_settings for select
  using (public.is_staff());
create policy shop_settings_update on public.shop_settings for update
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- profiles — everyone can see the staff directory (needed for the "Sold by"
-- / tech-assigned dropdowns); only an owner may edit roles, and never their
-- own last-owner row via the app (checked in the Users screen, not here).
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (public.is_staff());
create policy profiles_update on public.profiles for update
  using (public.is_owner()) with check (public.is_owner());
create policy profiles_delete on public.profiles for delete
  using (public.is_owner());

-- ---------------------------------------------------------------------------
-- customers — shop staff only, both roles, full access
-- ---------------------------------------------------------------------------
create policy customers_all on public.customers for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- parts — base table is intentionally NOT selectable by staff or dealers.
-- Reads go through parts_view / dealer_catalog (0004_views.sql) so cost is
-- masked at the SQL layer, not just hidden in the UI. Writes (receiving
-- stock, editing price) are staff-only and go through the base table.
-- ---------------------------------------------------------------------------
create policy parts_write on public.parts for all
  using (public.is_staff()) with check (public.is_staff());
-- (no select policy — see the views instead)

create policy bundles_select on public.bundles for select
  using (public.is_staff() or public.is_dealer());
create policy bundles_write on public.bundles for insert with check (public.is_staff());
create policy bundles_write_upd on public.bundles for update using (public.is_staff());
create policy bundles_write_del on public.bundles for delete using (public.is_staff());

create policy bundle_lines_select on public.bundle_lines for select
  using (public.is_staff() or public.is_dealer());
create policy bundle_lines_write on public.bundle_lines for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- dealers / dealer_users — owner only on the shop side. A dealer user may
-- read (only) their own account row so the portal can show tier/balance.
-- ---------------------------------------------------------------------------
create policy dealers_owner on public.dealers for all
  using (public.is_owner()) with check (public.is_owner());
create policy dealers_self_select on public.dealers for select
  using (id = public.current_dealer_id());

create policy dealer_users_owner on public.dealer_users for all
  using (public.is_owner()) with check (public.is_owner());
create policy dealer_users_self on public.dealer_users for select
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- tickets / labor_lines / part_lines — shop staff, both roles
-- ---------------------------------------------------------------------------
create policy tickets_all on public.tickets for all
  using (public.is_staff()) with check (public.is_staff());
create policy labor_lines_all on public.labor_lines for all
  using (public.is_staff()) with check (public.is_staff());
create policy part_lines_all on public.part_lines for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- orders / order_lines — owner sees/manages the whole queue; a dealer sees
-- and creates only their own orders, and only while status hasn't moved
-- past submitted/quote_requested (approval is shop-side only).
-- ---------------------------------------------------------------------------
create policy orders_owner on public.orders for all
  using (public.is_owner()) with check (public.is_owner());
create policy orders_dealer_select on public.orders for select
  using (dealer_id = public.current_dealer_id());
create policy orders_dealer_insert on public.orders for insert
  with check (dealer_id = public.current_dealer_id() and status in ('submitted','quote_requested'));

create policy order_lines_owner on public.order_lines for all
  using (public.is_owner()) with check (public.is_owner());
create policy order_lines_dealer_select on public.order_lines for select
  using (exists (select 1 from public.orders o
                 where o.id = order_lines.order_id
                   and o.dealer_id = public.current_dealer_id()));
create policy order_lines_dealer_insert on public.order_lines for insert
  with check (exists (select 1 from public.orders o
                       where o.id = order_lines.order_id
                         and o.dealer_id = public.current_dealer_id()));

-- ---------------------------------------------------------------------------
-- invoices / invoice_lines — shop staff, both roles (creation happens via
-- the create_invoice_from_ticket / invoice_dealer_order RPCs, not direct
-- insert, so totals/tax can't be forged from the client)
-- ---------------------------------------------------------------------------
create policy invoices_select on public.invoices for select
  using (public.is_staff());
create policy invoices_update on public.invoices for update
  using (public.is_staff()) with check (public.is_staff());
create policy invoice_lines_select on public.invoice_lines for select
  using (public.is_staff());

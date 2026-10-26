-- Red Solutions shop system: core schema
-- Mirrors the data model in project/design_handoff_multi_computer/README.md,
-- refined into real tables/sequences/relations.

create extension if not exists pgcrypto;

-- ============================================================================
-- Settings (singleton) — the prototype's "Tweaks" panel
-- ============================================================================
create table public.shop_settings (
  id boolean primary key default true,
  shop_name text not null default 'Red Solutions',
  address text not null default '48303 115th Ave, Leigh NE 68643',
  labor_rate numeric(10,2) not null default 120.00,
  tax_rate numeric(6,4) not null default 0.0550,
  low_stock_threshold integer not null default 3,
  notify_emails text[] not null default array['jackson@redstarne.com','austin@redsolutionsne.com'],
  constraint shop_settings_singleton check (id)
);
insert into public.shop_settings (id) values (true);

-- ============================================================================
-- Users / roles
-- ============================================================================
-- profiles: one row per shop-staff auth user (owner or tech). Dealer portal
-- users live in dealer_users instead — role is which table the auth user
-- has a row in, not a column, so a dealer login can never see shop tables.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('owner','tech')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  contact text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Parts catalog / inventory
-- ============================================================================
create table public.parts (
  sku text primary key,
  name text not null,
  category text,
  fits text[] not null default '{}',
  qty_on_hand integer not null default 0,
  cost numeric(12,2) not null default 0,   -- 0 = unknown (the shop's own sentinel — never treat as a real $0 cost)
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bundles (
  id bigint generated always as identity primary key,
  sku text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.bundle_lines (
  bundle_id bigint not null references public.bundles(id) on delete cascade,
  sku text not null references public.parts(sku),
  qty integer not null default 1 check (qty > 0),
  primary key (bundle_id, sku)
);

-- ============================================================================
-- Dealers (accounts + portal logins)
-- ============================================================================
create table public.dealers (
  id bigint generated always as identity primary key,
  name text not null,
  contact text,
  phone text,
  email text,
  discount_pct numeric(5,2) not null default 15 check (discount_pct >= 0 and discount_pct <= 100),
  terms text not null default 'Net 30',
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.dealer_users (
  id uuid primary key references auth.users(id) on delete cascade,
  dealer_id bigint not null references public.dealers(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Sequences for human-facing IDs (must be server-side so two machines never collide)
-- ============================================================================
create sequence public.ticket_no_seq start 1001;
create sequence public.invoice_no_seq start 1001;
create sequence public.order_no_seq start 2001;

-- security definer so callers only need EXECUTE (granted to PUBLIC by
-- default) rather than USAGE on the sequence itself
create function public.next_ticket_id() returns text
  language sql volatile security definer set search_path = public as
  $$ select 'R-' || nextval('public.ticket_no_seq')::text $$;

create function public.next_invoice_id() returns text
  language sql volatile security definer set search_path = public as
  $$ select 'INV-' || nextval('public.invoice_no_seq')::text $$;

create function public.next_order_id() returns bigint
  language sql volatile security definer set search_path = public as
  $$ select nextval('public.order_no_seq') $$;

-- ============================================================================
-- Repair tickets
-- ============================================================================
create table public.tickets (
  id text primary key default public.next_ticket_id(),
  customer_id bigint references public.customers(id),
  make text,
  model text,
  serial text,
  issue text,
  tech_id uuid references public.profiles(id),
  warranty text not null default 'none' check (warranty in ('none','warranty','insurance')),
  claim text,
  status text not null default 'intake' check (status in ('intake','diagnosis','in_repair','invoiced')),
  opened_at timestamptz not null default now(),
  notes text
);

create table public.labor_lines (
  id bigint generated always as identity primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  description text not null,
  hours numeric(6,2) not null check (hours > 0),
  rate numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- one row per part (or bundle) pulled onto a ticket
create table public.part_lines (
  id bigint generated always as identity primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  sku text references public.parts(sku),
  name text not null,
  qty integer not null check (qty > 0),
  price numeric(10,2) not null,
  bundle_id bigint references public.bundles(id),
  kit jsonb,                        -- snapshot of bundle components at pull time
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Dealer orders
-- ============================================================================
create table public.orders (
  id bigint primary key default public.next_order_id(),
  dealer_id bigint not null references public.dealers(id),
  po text,
  ship_address text,
  ship_method text,
  is_quote boolean not null default false,
  status text not null default 'submitted'
    check (status in ('quote_requested','submitted','approved','rejected','invoiced')),
  created_at timestamptz not null default now()
);

create table public.order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  sku text references public.parts(sku),
  bundle_id bigint references public.bundles(id),
  name text not null,
  qty integer not null check (qty > 0),
  price numeric(10,2) not null,     -- dealer price at order time
  retail numeric(10,2) not null,    -- retail at order time
  kit jsonb
);

-- ============================================================================
-- Invoices (immutable snapshot once created — tax_rate and every line are
-- frozen, so a later rate or price change never reprices history)
-- ============================================================================
create table public.invoices (
  id text primary key default public.next_invoice_id(),
  ticket_id text references public.tickets(id),
  order_id bigint references public.orders(id),
  date date not null default current_date,
  due_date date,
  -- this tracks QuickBooks export state, not payment status — the prototype
  -- has no paid/unpaid concept, only "has this gone to QBO yet"
  qbo_status text not null default 'draft' check (qbo_status in ('draft','exported','sent')),
  terms text not null default 'Net 30',
  rep uuid references public.profiles(id),
  tax_exempt boolean not null default false,
  tax_rate numeric(6,4) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_source check (
    (ticket_id is not null and order_id is null) or
    (ticket_id is null and order_id is not null)
  )
);

-- a ticket or order can only ever be invoiced once
create unique index invoices_ticket_id_uniq on public.invoices (ticket_id) where ticket_id is not null;
create unique index invoices_order_id_uniq on public.invoices (order_id) where order_id is not null;

create table public.invoice_lines (
  id bigint generated always as identity primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  kind text not null check (kind in ('labor','part','bundle')),
  description text not null,
  qty numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  amount numeric(12,2) not null,
  kit jsonb
);

create index on public.part_lines (ticket_id);
create index on public.labor_lines (ticket_id);
create index on public.invoice_lines (invoice_id);
create index on public.order_lines (order_id);
create index on public.parts (category);
create index on public.tickets (status);
create index on public.orders (dealer_id);
create index on public.dealer_users (dealer_id);

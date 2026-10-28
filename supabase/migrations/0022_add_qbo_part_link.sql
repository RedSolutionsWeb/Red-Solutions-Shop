-- Link each shop part to its matching QuickBooks Online product/service
-- item (name + internal ID), for the parts where a confident match exists.
-- Quantities and prices are intentionally left alone — only the name/ID
-- link is being brought in for now.
alter table public.parts
  add column if not exists qbo_item_name text,
  add column if not exists qbo_item_id text;

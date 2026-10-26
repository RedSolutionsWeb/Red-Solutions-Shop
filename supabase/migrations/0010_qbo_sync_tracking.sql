-- Tracks the QuickBooks Online invoice created by the sync Routine (see
-- project conversation history for the Routine's prompt), so the app can
-- link back to it instead of just showing a qbo_status of "sent".
alter table public.invoices
  add column qbo_invoice_id text,
  add column qbo_link text;

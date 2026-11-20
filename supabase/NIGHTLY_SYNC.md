# Nightly QuickBooks invoice sync

A scheduled trigger ("Red Solutions: daily QuickBooks invoice sync",
`trig_01E4ZiB3x8aLxcdTpmQeTobd`, ~02:08 UTC) wakes this same persistent
Claude session every night. There's no script — the trigger's stored
prompt just re-asks Claude to run the sync, and Claude executes it using
the Supabase + QuickBooks MCP tools, the same way a human operator would.

## What it does

Find every Supabase invoice (project `nhhzcuwumpyopdatmpcz`) where
`qbo_status = 'draft' and qbo_invoice_id is null`, and for each one:

1. Resolve the customer and every line's product in QuickBooks.
2. Create the matching invoice in QuickBooks Online.
3. Write `qbo_status='sent'`, `qbo_invoice_id`, `qbo_link` back onto the
   Supabase row.

## Policy for an unmatched part (added 2026-11-20)

Most parts in `public.parts` don't have a QuickBooks item linked yet
(`qbo_item_id is null` — currently a majority of the active catalog,
since a large batch was reactivated from a pending-reconciliation bucket
that never got finished). When an invoice line's part has no link and no
confident name match is found in QuickBooks:

- **Do not** auto-create a new QuickBooks item for it. Creating
  QuickBooks items is a guarded, explicit-approval action — fine when
  Jackson is in the room and says "yes, make it," never appropriate to
  do unattended overnight on a guess.
- Leave that invoice as `qbo_status='draft'` (don't partially sync it)
  and note which SKU/part needs a QuickBooks item.
- At the end of the run, report back: what synced normally, AND what's
  stuck waiting on a missing QuickBooks item (with the part name/SKU for
  each) -- not silence. Only stay fully silent if there was truly
  nothing to sync and nothing held up.

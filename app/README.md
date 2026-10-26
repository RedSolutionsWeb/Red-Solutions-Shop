# Red Solutions Shop — real implementation

Production build of the Claude Design prototype (`RedSolutions Shop.dc.html`
and `Dealer Portal.dc.html`): React + Supabase (Postgres, Auth, RLS,
Edge Functions), replacing the prototype's single-browser `localStorage` with
a real shared backend so the owner, techs, and dealers can all use it from
their own devices at once.

## Stack

- **Frontend**: React 19 + Vite + TypeScript, React Router. One app, two
  gated experiences: shop staff (owner/tech) at `/`, dealers at the same
  origin — which screen renders is decided by which table the signed-in
  user has a row in (`profiles` vs `dealer_users`), not a separate deploy.
- **Backend**: Supabase — Postgres schema + RLS in `supabase/migrations/`,
  one Edge Function (`supabase/functions/admin-users`) for account
  creation/removal (needs the service role key, so it can't run client-side).

## Two things lost in a container reclaim — read before assuming parity

This project was rebuilt once already after an idle container got reclaimed
with nothing committed. The rebuild restored every file this session
authored (all SQL, all TSX) exactly, by replaying it from conversation
history. Two things could **not** be restored because they were binary or
bulk data that only ever lived in the original Claude Design export, never
echoed in full into any conversation:

1. **The 858-SKU parts catalog.** `supabase/migrations/0007_seed_parts_catalog.sql`
   currently seeds only the 3 hardcoded shop rows (complete-aircraft
   placeholders + shop supplies), not the real catalog. If you still have
   the `redsolutions_schema.sql` file sent earlier in this project's
   history (or already ran it in the Supabase SQL Editor), the real data
   may already be safe — check `select count(*) from parts;` in your
   project. If not, it needs to come from the original
   `project/parts-catalog.json` export or a fresh CSV from the shop's
   records, via Inventory → Bulk upload parts.
2. **The logo image assets** (`logo-full.png`, `logo-full-white.png`,
   `logo-gear.png`). `src/ui/Logo.tsx` is a text-based placeholder in the
   Modernist style standing in for them. Re-upload the original files (or
   new ones) to `src/assets/` and swap the `<Logo>` usages for `<img>` tags
   once you have them.

**Lesson applied going forward:** this repo now has a real git history and
should be pushed to a remote as work lands, not left only in the container.

## Setting up a real Supabase project

1. Create a project at supabase.com (or self-host).
2. Link it and push the schema:
   ```
   supabase link --project-ref <your-ref>
   supabase db push
   ```
   This applies every file in `supabase/migrations/` in order — schema,
   RLS policies, views, and the business-rule RPCs
   (`pull_part`, `pull_bundle`, `create_invoice_from_ticket`,
   `submit_dealer_order`, `approve_dealer_order`, `invoice_dealer_order`, …).

   If your network can't reach `api.supabase.com` or the IPv6-only direct DB
   host (common in sandboxed dev environments), paste the migrations
   directly into the project's **SQL Editor** instead — same SQL, no CLI
   needed, run over your own browser's HTTPS.
3. Deploy the edge function:
   ```
   supabase functions deploy admin-users
   ```
4. In the dashboard, set **Authentication → Policies → Password minimum
   length to 4** — the shop's sign-in is a deliberate "email + 4-digit PIN"
   design choice (see the design chat transcripts), not a placeholder to
   harden later. `supabase/config.toml` already sets this for local dev.
5. Copy `.env.example` to `.env` and fill in the project's URL and anon key
   (Project Settings → API).
6. Create the first owner account directly (there's no one to click "Add a
   user" yet) via **Authentication → Users → Add user** in the dashboard,
   setting user metadata to:
   ```json
   {"kind": "staff", "role": "owner", "name": "Jackson Mullenhoff"}
   ```
   The `handle_new_auth_user` trigger turns that into the owner profile row
   automatically. Every account after that is created from the app's own
   **Users** screen.

## Local development

```
npm install
cp .env.example .env   # fill in from `supabase start` output
npm run dev
```

`supabase/seed.sql` seeds two demo staff logins and a test dealer account —
**local dev only**, it is never applied to a linked hosted project.

## What's deliberately different from the prototype

A few places where "recreate the design, not the prototype's internal
structure" meant a real behavior change rather than a literal port:

- **`tickets.tech_id` is a real foreign key to `profiles`**, not the
  prototype's free-text `tech` field — the prototype's own spec review
  flagged the free-text version as something a real rebuild should fix,
  since it silently fractured the tech-hours report on any typo.
- **Invoice totals and lines are snapshotted at creation**
  (`invoices.tax_rate`, `invoice_lines`), not recomputed live the way the
  prototype's ticket totals are — per the handoff README's own explicit
  recommendation ("most shops want frozen... Recommend storing the rate
  per invoice").
- **Cost is guarded server-side, not just hidden in the UI.** A tech's
  Supabase session cannot read `parts.cost` (masked by `parts_view`) or
  write it (clamped by a trigger even on a direct API call).
- **Passwords are real Supabase Auth (hashed, server-verified) sign-ins**,
  not the prototype's plaintext-PIN string comparison — while keeping the
  same email + 4-digit-PIN UX the client iterated on.

Everything else — the $120/hr labor rate, 5.5% tax exempt on warranty/
insurance and dealer resale, stock decrementing at pull time and allowed to
go negative, bundle components snapshotted at pull time, dealer orders
invoiceable without requiring approval first, the exact QuickBooks CSV
column order — is a direct port of the business rules documented in the
design handoff and verified against the source `.dc.html` files.

## Known gaps vs. the full prototype

- **Exploded parts diagrams** — never fully specified in the design chats
  either; not built here.
- **Live updates across devices** — screens refetch on navigation/mutation,
  not via realtime subscriptions. Supabase Realtime would close this gap
  without a schema change.
- **Reports** are computed client-side from full-table fetches, fine at
  this shop's scale but worth moving to SQL aggregates if the dataset grows.
- **QuickBooks**: currently CSV export only (exact QBO import-column
  format). A Claude-connector-based sync (push draft invoices to QuickBooks
  on request, or on a schedule) is the next piece under discussion — see
  the project conversation for the design.

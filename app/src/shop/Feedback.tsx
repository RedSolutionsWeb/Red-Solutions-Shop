import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../ui/Toast'
import type { Feedback as FeedbackRow, Profile } from '../lib/types'
import { Button } from '../ui/Button'
import { Field, Textarea } from '../ui/Field'
import { Tag } from '../ui/Tag'

// Maps a route to something readable for a report, without needing to
// fetch extra data — static routes get their nav label, routes with an
// id in them (tickets/invoices/etc.) get labeled with that id.
function describePath(path: string | null): string {
  if (!path) return '—'
  const [pathname] = path.split('?')
  const segments = pathname.split('/').filter(Boolean)
  const STATIC: Record<string, string> = {
    '': 'Job board',
    intake: 'New intake',
    sale: 'Parts sale',
    inventory: 'Inventory',
    bundles: 'Bundles',
    customers: 'Customers',
    drones: 'Drone history',
    orders: 'Dealer orders',
    dealers: 'Dealers',
    invoices: 'Invoicing',
    counts: 'Inventory count',
    reports: 'Reports',
    users: 'Users',
  }
  if (segments.length === 0) return STATIC['']
  const [section, id] = segments
  const LABEL: Record<string, string> = {
    tickets: 'Ticket',
    invoices: 'Invoice',
    orders: 'Dealer order',
    counts: 'Inventory count',
  }
  if (id && LABEL[section]) return `${LABEL[section]} ${id}`
  return STATIC[section] ?? path
}

export function Feedback() {
  const { identity } = useAuth()
  const toast = useToast()
  const isOwner = identity?.kind === 'staff' && identity.profile.role === 'owner'

  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [message, setMessage] = useState('')
  const [expected, setExpected] = useState('')
  const [busy, setBusy] = useState(false)
  const lastPath = sessionStorage.getItem('rs_last_path')

  async function load() {
    const [feedbackRes, profilesRes] = await Promise.all([
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setRows((feedbackRes.data as FeedbackRow[]) ?? [])
    setProfiles((profilesRes.data as Profile[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  function nameFor(id: string) {
    return profiles.find((p) => p.id === id)?.name ?? '—'
  }

  async function submit() {
    if (!message.trim() || !identity || identity.kind !== 'staff') return
    setBusy(true)
    const { error } = await supabase.from('feedback').insert({
      reported_by: identity.profile.id,
      message: message.trim(),
      expected: expected.trim() || null,
      page_path: lastPath,
    })
    setBusy(false)
    if (error) {
      toast('Could not submit — try again')
      return
    }
    setMessage('')
    setExpected('')
    toast('Reported — thanks')
    load()
  }

  async function resolve(id: number) {
    if (!identity || identity.kind !== 'staff') return
    await supabase
      .from('feedback')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: identity.profile.id })
      .eq('id', id)
    load()
  }

  const open = rows.filter((r) => r.status === 'open')
  const resolved = rows.filter((r) => r.status === 'resolved')

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>Report a problem</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Found a bug, a wrong price, something confusing? It's tied to your name so it's easy to follow up with you.
      </p>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="What happened?">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Be as specific as you can — what you clicked, what showed up, any numbers involved"
            style={{ minHeight: 64 }}
          />
        </Field>
        <Field label="What should have happened instead? (optional)">
          <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} style={{ minHeight: 48 }} />
        </Field>
        <div className="muted" style={{ fontSize: 12 }}>Reporting from: {describePath(lastPath)}</div>
        <div>
          <Button variant="primary" onClick={submit} disabled={busy || !message.trim()}>
            Submit
          </Button>
        </div>
      </div>

      {!isOwner && (
        <p className="muted" style={{ marginTop: 32 }}>
          This goes directly to Jackson — only he can see what's been reported.
        </p>
      )}

      {isOwner && (
        <>
          <h3 style={{ marginTop: 32, marginBottom: 8 }}>Open ({open.length})</h3>
          {open.length === 0 && <p className="muted">Nothing open.</p>}
          {open.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{nameFor(r.reported_by)}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{describePath(r.page_path)}</div>
              <div style={{ marginTop: 8 }}>
                <span className="kicker">Happened</span>
                <div style={{ whiteSpace: 'pre-wrap' }}>{r.message}</div>
              </div>
              {r.expected && (
                <div style={{ marginTop: 8 }}>
                  <span className="kicker">Expected instead</span>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{r.expected}</div>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <Button variant="secondary" onClick={() => resolve(r.id)}>
                  Mark resolved
                </Button>
              </div>
            </div>
          ))}

          {resolved.length > 0 && (
            <>
              <h3 style={{ marginTop: 32, marginBottom: 8 }}>Resolved ({resolved.length})</h3>
              {resolved.map((r) => (
                <div key={r.id} className="card" style={{ padding: 16, marginBottom: 8, opacity: 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong>{nameFor(r.reported_by)}</strong>
                    <Tag variant="neutral">Resolved by {nameFor(r.resolved_by ?? '')}</Tag>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{describePath(r.page_path)}</div>
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.message}</div>
                  {r.expected && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }} className="muted">{r.expected}</div>}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

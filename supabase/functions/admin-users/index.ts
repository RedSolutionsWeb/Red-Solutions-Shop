// Creates and removes staff/dealer logins. Runs with the service role key
// (never exposed to the browser) so this is the only place account
// creation/removal can happen — the Users screen calls this instead of
// touching auth.users directly. Every request is re-checked against the
// CALLER's own JWT (not trusted from the request body) so only a signed-in
// owner can use it.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'not authenticated' }, 401)

    const { data: profile } = await callerClient.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (profile?.role !== 'owner') return json({ error: 'owner only' }, 403)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const body = await req.json()

    if (body.action === 'create_staff') {
      const { name, email, pin, role } = body
      if (!name || !email || !pin) return json({ error: 'Name, email and PIN are all required.' }, 400)
      const { data: existing } = await admin.auth.admin.listUsers()
      if (existing.users.some((u) => u.email?.toLowerCase() === String(email).toLowerCase())) {
        return json({ error: 'That email already has an account.' }, 400)
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(pin).trim(),
        email_confirm: true,
        user_metadata: { kind: 'staff', role: role === 'owner' ? 'owner' : 'tech', name },
      })
      if (error) return json({ error: error.message }, 400)
      return json({ id: data.user?.id })
    }

    if (body.action === 'remove_user') {
      const { userId } = body
      if (userId === caller.id) return json({ error: 'cannot remove your own account' }, 400)
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      if ((count ?? 0) <= 1) return json({ error: 'at least one user must remain' }, 400)
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

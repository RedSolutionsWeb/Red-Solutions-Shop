// Sends a Web Push notification to every device the given feedback
// report's original reporter has enabled notifications on. Called from
// Feedback.tsx right after a manager/owner marks a report resolved.
// Runs with the service role key (never exposed to the browser) so it
// can read push_subscriptions for a user other than the caller, but the
// caller's own JWT is re-checked first so only a manager/owner can
// trigger a push.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Public VAPID key isn't sensitive -- it's shipped in the frontend bundle
// too (lib/webpush.ts) so the browser can subscribe. Only the private key
// is a real secret, set via `supabase secrets set VAPID_PRIVATE_KEY=...`.
const VAPID_PUBLIC_KEY = 'BFCY4_qhNW-Pwdq5hkfPQdRrYbAF1EBVjNUQ4pQRZrEPyy8-Z2nA0X_JOUUr8B-dFqPhNgunf_KJu-lv8sESU3U'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:jackson@redstarne.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) return json({ error: 'not authenticated' }, 401)

    const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (!callerProfile || !['owner', 'sales'].includes(callerProfile.role)) {
      return json({ error: 'manager or owner only' }, 403)
    }

    const { feedback_id } = await req.json()
    if (!feedback_id) return json({ error: 'feedback_id is required' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: feedback } = await admin.from('feedback').select('id, reported_by, message, status').eq('id', feedback_id).maybeSingle()
    if (!feedback) return json({ error: 'feedback not found' }, 404)
    if (feedback.status !== 'resolved') return json({ error: 'feedback is not resolved' }, 400)

    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', feedback.reported_by)
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0 })

    const payload = JSON.stringify({
      title: 'Red Solutions Shop',
      body: `Your reported issue was resolved: "${feedback.message.slice(0, 80)}${feedback.message.length > 80 ? '…' : ''}"`,
    })

    let sent = 0
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        sent++
      } catch (err) {
        // 404/410 means the browser revoked this subscription (uninstalled,
        // permissions cleared, etc.) -- stop trying to push to it.
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    return json({ ok: true, sent })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

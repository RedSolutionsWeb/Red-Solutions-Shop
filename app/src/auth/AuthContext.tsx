import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { DealerUser, Profile } from '../lib/types'

type Identity =
  | { kind: 'staff'; profile: Profile }
  | { kind: 'dealer'; dealerUser: DealerUser }
  | null

interface AuthState {
  session: Session | null
  identity: Identity
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshIdentity: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function resolveIdentity(userId: string): Promise<Identity> {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (profile) return { kind: 'staff', profile: profile as Profile }

  const { data: dealerUser } = await supabase.from('dealer_users').select('*').eq('id', userId).maybeSingle()
  if (dealerUser) return { kind: 'dealer', dealerUser: dealerUser as DealerUser }

  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [identity, setIdentity] = useState<Identity>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(nextSession: Session | null) {
      setSession(nextSession)
      if (nextSession?.user) {
        const id = await resolveIdentity(nextSession.user.id)
        if (!cancelled) setIdentity(id)
      } else {
        setIdentity(null)
      }
      if (!cancelled) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      load(nextSession)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password.trim(),
    })
    if (error) return { error: 'That email and password do not match an account.' }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshIdentity() {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      setIdentity(await resolveIdentity(data.session.user.id))
    }
  }

  return (
    <AuthContext.Provider value={{ session, identity, loading, error: null, signIn, signOut, refreshIdentity }}>
      {children}
    </AuthContext.Provider>
  )
}

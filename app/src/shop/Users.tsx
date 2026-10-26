import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../ui/Toast'
import type { Profile, Role } from '../lib/types'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Field'

export function Users() {
  const { identity } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<Role>('tech')
  const [error, setError] = useState('')

  const myId = identity?.kind === 'staff' ? identity.profile.id : null

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setUsers((data as Profile[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function setUserRole(id: string, newRole: Role) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    load()
  }

  async function addUser() {
    setError('')
    if (!name.trim() || !email.trim() || !pin.trim()) {
      setError('Name, email and PIN are all required.')
      return
    }
    const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
      body: { action: 'create_staff', name, email, pin, role },
    })
    if (fnError || data?.error) {
      setError(data?.error ?? fnError?.message ?? 'Could not add user.')
      return
    }
    setName('')
    setEmail('')
    setPin('')
    setRole('tech')
    toast(`${name} can now sign in`)
    load()
  }

  async function removeUser(id: string) {
    const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
      body: { action: 'remove_user', userId: id },
    })
    if (fnError || data?.error) {
      toast(data?.error ?? fnError?.message ?? 'Could not remove user.')
      return
    }
    load()
  }

  return (
    <div>
      <h2 style={{ margin: 0 }}>Users</h2>
      <p className="muted">Techs see retail prices only. Owners see cost, margin, dealers and reports.</p>

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Sign-in email</th>
            <th>PIN</th>
            <th>Access</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === myId ? ' (you)' : ''}
              </td>
              <td>{u.email}</td>
              <td>••••</td>
              <td>
                <Select value={u.role} onChange={(e) => setUserRole(u.id, e.target.value as Role)}>
                  <option value="owner">Owner — full access</option>
                  <option value="tech">Tech — no costs</option>
                </Select>
              </td>
              <td>
                {u.id !== myId && (
                  <button className="btn btn-ghost" onClick={() => removeUser(u.id)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h5 style={{ marginTop: 24 }}>Add a user</h5>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="PIN">
          <Input value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Field label="Access">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="tech">Tech</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>
        <Button variant="primary" onClick={addUser}>
          Add
        </Button>
      </div>
      {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}

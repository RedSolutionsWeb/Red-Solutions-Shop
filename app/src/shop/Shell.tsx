import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useReload } from './ReloadContext'
import { useNavCounts } from './navCounts'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { Dialog } from '../ui/Dialog'
import { ChangePasswordForm } from './ChangePassword'
import { useToast } from '../ui/Toast'

interface NavItem {
  key: string
  label: string
  path: string
  ownerOnly?: boolean
  count?: (c: ReturnType<typeof useNavCounts>) => number | undefined
}

const NAV: NavItem[] = [
  { key: 'board', label: 'Job board', path: '/', count: (c) => c.openTickets },
  { key: 'intake', label: 'New intake', path: '/intake' },
  { key: 'inventory', label: 'Inventory', path: '/inventory', count: (c) => c.parts },
  { key: 'bundles', label: 'Bundles', path: '/bundles', count: (c) => c.bundles },
  { key: 'customers', label: 'Customers', path: '/customers', count: (c) => c.customers },
  {
    key: 'orders',
    label: 'Dealer orders',
    path: '/orders',
    ownerOnly: true,
    count: (c) => (c.pendingOrders > 0 ? c.pendingOrders : undefined),
  },
  { key: 'dealers', label: 'Dealers', path: '/dealers', ownerOnly: true, count: (c) => c.dealers },
  { key: 'invoices', label: 'Invoicing', path: '/invoices', count: (c) => c.invoices },
  { key: 'reports', label: 'Reports', path: '/reports', ownerOnly: true },
  { key: 'users', label: 'Users', path: '/users', ownerOnly: true },
]

export function Shell() {
  const { identity } = useAuth()
  if (identity?.kind !== 'staff') return null
  return <ShellInner isOwner={identity.profile.role === 'owner'} name={identity.profile.name} />
}

function ShellInner({ isOwner, name }: { isOwner: boolean; name: string }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { key } = useReload()
  const counts = useNavCounts(key, isOwner)
  const items = NAV.filter((n) => !n.ownerOnly || isOwner)
  const toast = useToast()
  const [pinOpen, setPinOpen] = useState(false)

  return (
    <div className="app-shell">
      <aside
        style={{
          borderRight: '2px solid var(--color-divider)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Logo height={52} />
        <div className="kicker" style={{ marginTop: 16, marginBottom: 16 }}>
          Repair &amp; inventory
        </div>
        <nav className="shell-nav">
          {items.map((item) => {
            const count = item.count?.(counts)
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 6px',
                  fontSize: 13,
                  color: 'inherit',
                  background: isActive ? 'color-mix(in srgb, var(--color-text) 6%, transparent)' : 'transparent',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: isActive ? 'var(--color-accent)' : 'transparent',
                        border: isActive ? 'none' : '1px solid var(--color-divider)',
                        flex: 'none',
                      }}
                    />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {count !== undefined && (
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{count}</span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 16 }}>
          QuickBooks: RedSolutions LLC
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '14px 24px',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <div style={{ marginRight: 'auto', fontSize: 13 }}>
            <strong>{name}</strong>{' '}
            <span style={{ opacity: 0.6 }}>{isOwner ? 'Owner' : 'Tech'}</span>
          </div>
          <Button variant="ghost" onClick={() => setPinOpen(true)}>
            Change password
          </Button>
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
          <Button variant="secondary" onClick={() => navigate('/inventory')}>
            Inventory
          </Button>
          <Button variant="primary" onClick={() => navigate('/intake')}>
            New intake
          </Button>
        </header>
        <main style={{ flex: 1, padding: 24 }}>
          <Outlet />
        </main>
      </div>

      {pinOpen && (
        <Dialog
          title="Change your password"
          onClose={() => setPinOpen(false)}
          actions={
            <Button variant="ghost" onClick={() => setPinOpen(false)}>
              Cancel
            </Button>
          }
        >
          <ChangePasswordForm
            onDone={() => {
              setPinOpen(false)
              toast('Password updated')
            }}
          />
        </Dialog>
      )}
    </div>
  )
}

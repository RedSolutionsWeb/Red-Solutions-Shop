import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ToastProvider } from './ui/Toast'
import { ReloadProvider } from './shop/ReloadContext'
import { SignIn } from './shop/SignIn'
import { SetPassword } from './shop/SetPassword'
import { Shell } from './shop/Shell'
import { JobBoard } from './shop/JobBoard'
import { Intake } from './shop/Intake'
import { RetailSale } from './shop/RetailSale'
import { TicketDetail } from './shop/TicketDetail'
import { Inventory } from './shop/Inventory'
import { Bundles } from './shop/Bundles'
import { Customers } from './shop/Customers'
import { Invoicing } from './shop/Invoicing'
import { InvoiceDetail } from './shop/InvoiceDetail'
import { Dealers } from './shop/Dealers'
import { DealerOrders } from './shop/DealerOrders'
import { DealerOrderDetail } from './shop/DealerOrderDetail'
import { Reports } from './shop/Reports'
import { Users } from './shop/Users'
import { RequireOwner } from './shop/RequireOwner'
import { RequireManager } from './shop/RequireManager'
import { DealerPortalApp } from './dealer-portal/DealerPortalApp'

function Gate() {
  const { loading, identity } = useAuth()

  if (loading) return null
  if (!identity) return <SignIn />

  if (identity.kind === 'dealer') return <DealerPortalApp />

  if (identity.profile.must_change_password) return <SetPassword />

  return (
    <ReloadProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<JobBoard />} />
          <Route path="intake" element={<Intake />} />
          <Route path="sale" element={<RetailSale />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="bundles" element={<Bundles />} />
          <Route path="customers" element={<Customers />} />
          <Route path="invoices" element={<Invoicing />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route
            path="orders"
            element={
              <RequireManager>
                <DealerOrders />
              </RequireManager>
            }
          />
          <Route
            path="orders/:id"
            element={
              <RequireManager>
                <DealerOrderDetail />
              </RequireManager>
            }
          />
          <Route
            path="dealers"
            element={
              <RequireManager>
                <Dealers />
              </RequireManager>
            }
          />
          <Route
            path="reports"
            element={
              <RequireManager>
                <Reports />
              </RequireManager>
            }
          />
          <Route
            path="users"
            element={
              <RequireOwner>
                <Users />
              </RequireOwner>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ReloadProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  )
}

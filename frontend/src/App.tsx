import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { AppShell } from '@/components/common/AppShell'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { PublicPassPage } from '@/pages/PublicPassPage'

// Admin pages
import { AdminDashboard } from '@/pages/admin/Dashboard'
import { CompaniesPage } from '@/pages/admin/Companies'
import { AdminEmployeesPage } from '@/pages/admin/Employees'
import { GatesPage } from '@/pages/admin/Gates'
import { GuardsPage } from '@/pages/admin/Guards'
import { AdminPassesPage } from '@/pages/admin/Passes'
import { AdminEntriesPage } from '@/pages/admin/Entries'
import { AdminDeliveriesPage } from '@/pages/admin/Deliveries'
import { AuditLogsPage } from '@/pages/admin/AuditLogs'

// Company pages
import { CompanyDashboard } from '@/pages/company/Dashboard'
import { CompanyEmployeesPage } from '@/pages/company/Employees'
import { CompanyPassesPage } from '@/pages/company/Passes'
import { CompanyEntriesPage } from '@/pages/company/Entries'
import { CompanyDeliveriesPage } from '@/pages/company/Deliveries'

// Employee pages
import { EmployeeDashboard } from '@/pages/employee/Dashboard'
import { EmployeePassesPage } from '@/pages/employee/Passes'
import { EmployeeDeliveriesPage } from '@/pages/employee/Deliveries'

// Guard pages
import { GuardDashboard } from '@/pages/guard/Dashboard'
import { ScanPage } from '@/pages/guard/Scan'
import { ActiveVisitorsPage } from '@/pages/guard/ActiveVisitors'
import { GuardDeliveriesPage } from '@/pages/guard/Deliveries'

function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={`/${user?.role}`} /> : <LoginPage />} />
      <Route path="/pass/:code" element={<PublicPassPage />} />

      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AppShell /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="employees" element={<AdminEmployeesPage />} />
        <Route path="gates" element={<GatesPage />} />
        <Route path="guards" element={<GuardsPage />} />
        <Route path="passes" element={<AdminPassesPage />} />
        <Route path="entries" element={<AdminEntriesPage />} />
        <Route path="deliveries" element={<AdminDeliveriesPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
      </Route>

      <Route path="/company" element={<ProtectedRoute allowedRoles={['company']}><AppShell /></ProtectedRoute>}>
        <Route index element={<CompanyDashboard />} />
        <Route path="employees" element={<CompanyEmployeesPage />} />
        <Route path="passes" element={<CompanyPassesPage />} />
        <Route path="entries" element={<CompanyEntriesPage />} />
        <Route path="deliveries" element={<CompanyDeliveriesPage />} />
      </Route>

      <Route path="/employee" element={<ProtectedRoute allowedRoles={['employee']}><AppShell /></ProtectedRoute>}>
        <Route index element={<EmployeeDashboard />} />
        <Route path="passes" element={<EmployeePassesPage />} />
        <Route path="deliveries" element={<EmployeeDeliveriesPage />} />
      </Route>

      <Route path="/guard" element={<ProtectedRoute allowedRoles={['guard']}><AppShell /></ProtectedRoute>}>
        <Route index element={<GuardDashboard />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="active" element={<ActiveVisitorsPage />} />
        <Route path="deliveries" element={<GuardDeliveriesPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App

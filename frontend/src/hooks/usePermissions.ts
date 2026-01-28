import { useAuthStore } from '@/store/authStore'

export function usePermissions() {
  const user = useAuthStore((state) => state.user)

  return {
    isAdmin: user?.role === 'admin',
    isCompanyAdmin: user?.role === 'company',
    isEmployee: user?.role === 'employee',
    isGuard: user?.role === 'guard',
    canManageCompanies: user?.role === 'admin',
    canManageEmployees: user?.role === 'admin' || user?.role === 'company',
    canManageGates: user?.role === 'admin',
    canManageGuards: user?.role === 'admin',
    canApprovePasses: user?.role === 'admin' || user?.role === 'company',
    canCreatePasses: user?.role === 'admin' || user?.role === 'company' || user?.role === 'employee',
    canCheckIn: user?.role === 'guard',
    canViewAnalytics: user?.role === 'admin' || user?.role === 'company',
    canViewAuditLogs: user?.role === 'admin',
    role: user?.role,
  }
}

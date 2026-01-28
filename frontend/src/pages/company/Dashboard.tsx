import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { companiesApi } from '@/api/companies'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Users, Ticket, LogIn, Package } from 'lucide-react'

export function CompanyDashboard() {
  const user = useAuthStore((s) => s.user)
  const companyId = user?.company?.id

  const { data: stats, isLoading } = useQuery({
    queryKey: ['company-stats', companyId],
    queryFn: () => companiesApi.stats(companyId!),
    enabled: !!companyId,
  })

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-6">
      <PageHeader title="Company Dashboard" description={user?.company?.name} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Employees" value={stats?.employee_count || 0} icon={Users} />
        <StatsCard title="Active Passes" value={stats?.active_passes || 0} icon={Ticket} />
        <StatsCard title="Today's Entries" value={stats?.today_entries || 0} icon={LogIn} />
        <StatsCard title="Pending Deliveries" value={stats?.pending_deliveries || 0} icon={Package} />
      </div>
    </div>
  )
}

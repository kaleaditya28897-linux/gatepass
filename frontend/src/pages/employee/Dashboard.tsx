import { useQuery } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { deliveriesApi } from '@/api/deliveries'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Ticket, Package } from 'lucide-react'

export function EmployeeDashboard() {
  const { data: passes, isLoading: loadingPasses } = useQuery({
    queryKey: ['my-passes'],
    queryFn: () => passesApi.list(),
  })

  const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: () => deliveriesApi.list(),
  })

  if (loadingPasses || loadingDeliveries) return <LoadingSpinner className="h-64" />

  const pendingPasses = passes?.results.filter((p) => p.status === 'pending').length || 0
  const pendingDeliveries = deliveries?.results.filter((d) => d.status === 'expected' || d.status === 'arrived').length || 0

  return (
    <div className="space-y-6">
      <PageHeader title="Employee Dashboard" description="Manage your visitors and deliveries" />
      <div className="grid gap-4 md:grid-cols-2">
        <StatsCard title="Pending Passes" value={pendingPasses} icon={Ticket} />
        <StatsCard title="Pending Deliveries" value={pendingDeliveries} icon={Package} />
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { entriesApi } from '@/api/entries'
import { deliveriesApi } from '@/api/deliveries'
import { shiftsApi } from '@/api/gates'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Package, DoorOpen } from 'lucide-react'

export function GuardDashboard() {
  const { data: shift } = useQuery({
    queryKey: ['my-shift'],
    queryFn: shiftsApi.myCurrent,
  })

  const { data: activeEntries, isLoading: loadingEntries } = useQuery({
    queryKey: ['active-entries'],
    queryFn: entriesApi.active,
  })

  const { data: pendingDeliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['pending-deliveries'],
    queryFn: deliveriesApi.pendingGate,
  })

  if (loadingEntries || loadingDeliveries) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-6">
      <PageHeader title="Guard Dashboard" description="Gate operations overview" />
      {shift && (
        <Card>
          <CardHeader><CardTitle>Current Shift</CardTitle></CardHeader>
          <CardContent>
            <p><strong>Gate:</strong> {shift.gate_name}</p>
            <p><strong>Shift:</strong> {new Date(shift.shift_start).toLocaleTimeString()} - {new Date(shift.shift_end).toLocaleTimeString()}</p>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Active Visitors" value={activeEntries?.results.length || 0} icon={Users} />
        <StatsCard title="Pending Deliveries" value={pendingDeliveries?.results.length || 0} icon={Package} />
        <StatsCard title="Current Gate" value={shift?.gate_name || 'Not assigned'} icon={DoorOpen} />
      </div>
    </div>
  )
}

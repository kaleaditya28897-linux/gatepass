import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { entriesApi } from '@/api/entries'
import { deliveriesApi } from '@/api/deliveries'
import { useGuardGate } from '@/hooks/useGuardGate'
import { GateSelector } from '@/components/guard/GateSelector'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/utils/formatters'
import { Package, ScanLine, UserPlus, Users } from 'lucide-react'

export function GuardDashboard() {
  const guardGate = useGuardGate()
  const { data: inside, isLoading: loadingEntries } = useQuery({
    queryKey: ['active-entries', 'count'],
    queryFn: () => entriesApi.active({ entry_type: 'visitor', page_size: '1' }),
    refetchInterval: 30000,
  })
  const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['pending-deliveries', 'count'],
    queryFn: () => deliveriesApi.pendingGate({ page_size: '1' }),
    refetchInterval: 30000,
  })

  if (loadingEntries || loadingDeliveries || guardGate.loading) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gate Desk"
        description={guardGate.shift
          ? `On shift until ${formatTime(guardGate.shift.shift_end)}`
          : 'No shift scheduled for you right now'}
      />
      <GateSelector guardGate={guardGate} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild className="h-16 text-base"><Link to="/guard/scan"><ScanLine className="h-5 w-5" /> Scan a pass</Link></Button>
        <Button asChild variant="outline" className="h-16 text-base"><Link to="/guard/walk-in"><UserPlus className="h-5 w-5" /> Walk-in visitor</Link></Button>
        <Button asChild variant="outline" className="h-16 text-base"><Link to="/guard/deliveries"><Package className="h-5 w-5" /> Deliveries</Link></Button>
      </div>
      <div className="grid gap-4 grid-cols-2">
        <Link to="/guard/active"><StatsCard title="Visitors inside" value={inside?.count ?? 0} icon={Users} /></Link>
        <Link to="/guard/deliveries"><StatsCard title="Open deliveries" value={deliveries?.count ?? 0} icon={Package} /></Link>
      </div>
    </div>
  )
}

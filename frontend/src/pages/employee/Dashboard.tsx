import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { passesApi } from '@/api/passes'
import { deliveriesApi } from '@/api/deliveries'
import { useAuthStore } from '@/store/authStore'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Hourglass, Package, Ticket, UserCheck } from 'lucide-react'

const count = (fetcher: (p: Record<string, string>) => Promise<{ count: number }>, status: string) =>
  fetcher({ status, page_size: '1' }).then((r) => r.count)

export function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery({
    queryKey: ['passes', 'employee-summary'],
    queryFn: async () => {
      const [pending, approved, inside, expected, arrived] = await Promise.all([
        count(passesApi.list, 'pending'), count(passesApi.list, 'approved'), count(passesApi.list, 'checked_in'),
        count(deliveriesApi.list, 'expected'), count(deliveriesApi.list, 'arrived'),
      ])
      return { pending, approved, inside, expected, arrived }
    },
    refetchInterval: 60000,
  })

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user?.first_name || user?.username}`}
        description="Your visitors and deliveries"
        action={
          <>
            <Button asChild><Link to="/employee/passes">Invite a visitor</Link></Button>
            <Button asChild variant="outline"><Link to="/employee/deliveries">Expect a delivery</Link></Button>
          </>
        }
      />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link to="/employee/passes"><StatsCard title="Passes awaiting approval" value={data?.pending ?? 0} icon={Hourglass} /></Link>
        <Link to="/employee/passes"><StatsCard title="Approved passes" value={data?.approved ?? 0} icon={Ticket} /></Link>
        <Link to="/employee/passes"><StatsCard title="Visitors inside now" value={data?.inside ?? 0} icon={UserCheck} /></Link>
        <Link to="/employee/deliveries">
          <StatsCard
            title="Open deliveries"
            value={(data?.expected ?? 0) + (data?.arrived ?? 0)}
            icon={Package}
            description={data?.arrived ? `${data.arrived} waiting at the gate` : undefined}
          />
        </Link>
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { companiesApi } from '@/api/companies'
import { analyticsApi } from '@/api/analytics'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Ticket, LogIn, Package, Hourglass, UserCheck } from 'lucide-react'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const dayLabel = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function CompanyDashboard() {
  const user = useAuthStore((s) => s.user)
  const companyId = user?.company?.id

  const { data: stats, isLoading } = useQuery({
    queryKey: ['company-stats', companyId],
    queryFn: () => companiesApi.stats(companyId!),
    enabled: !!companyId,
    refetchInterval: 60000,
  })
  const { data: byDate } = useQuery({
    queryKey: ['analytics-entries-by-date', 'company'],
    queryFn: () => analyticsApi.entriesByDate(14),
    enabled: !!companyId,
  })

  if (!companyId) {
    return (
      <div className="rounded-md border bg-card p-6">
        <h1 className="text-lg font-semibold">Your account is not linked to a company yet</h1>
        <p className="mt-1 text-muted-foreground">Ask the building admin to assign you as the admin of your company.</p>
      </div>
    )
  }
  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-6">
      <PageHeader title={user?.company?.name ?? 'Company Dashboard'} description="Visitors and deliveries for your company" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Link to="/company/passes"><StatsCard title="Passes awaiting your approval" value={stats?.pending_passes ?? 0} icon={Hourglass} /></Link>
        <Link to="/company/passes"><StatsCard title="Approved, not yet arrived" value={stats?.active_passes ?? 0} icon={Ticket} /></Link>
        <Link to="/company/entries"><StatsCard title="Visitors inside now" value={stats?.visitors_inside ?? 0} icon={UserCheck} /></Link>
        <Link to="/company/entries"><StatsCard title="Visitors today" value={stats?.today_entries ?? 0} icon={LogIn} /></Link>
        <Link to="/company/deliveries"><StatsCard title="Open deliveries" value={stats?.pending_deliveries ?? 0} icon={Package} /></Link>
        <Link to="/company/employees"><StatsCard title="Employees" value={stats?.employee_count ?? 0} icon={Users} /></Link>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Entries per day (last 14 days)</CardTitle></CardHeader>
        <CardContent>
          {byDate?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDate}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip labelFormatter={dayLabel} />
                <Bar dataKey="count" name="Entries" style={{ fill: 'hsl(var(--primary))' }} isAnimationActive={false} maxBarSize={56} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">No entries recorded in this period yet.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

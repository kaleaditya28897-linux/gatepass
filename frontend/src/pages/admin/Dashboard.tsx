import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api/analytics'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Building2, Ticket, Users, Package, LogIn, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function AdminDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: analyticsApi.overview,
  })

  const { data: entriesByDate } = useQuery({
    queryKey: ['analytics-entries-by-date'],
    queryFn: () => analyticsApi.entriesByDate(14),
  })

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" description="Overview of your business center" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard title="Total Companies" value={overview?.total_companies || 0} icon={Building2} />
        <StatsCard title="Passes Today" value={overview?.total_passes_today || 0} icon={Ticket} />
        <StatsCard title="Active Visitors" value={overview?.active_visitors || 0} icon={Users} />
        <StatsCard title="Pending Deliveries" value={overview?.pending_deliveries || 0} icon={Package} />
        <StatsCard title="Checked In Today" value={overview?.checked_in_today || 0} icon={LogIn} />
        <StatsCard title="Checked Out Today" value={overview?.checked_out_today || 0} icon={LogOut} />
      </div>
      {entriesByDate && entriesByDate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entries (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={entriesByDate}>
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

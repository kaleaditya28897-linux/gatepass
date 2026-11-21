import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi } from '@/api/analytics'
import { PageHeader } from '@/components/common/PageHeader'
import { StatsCard } from '@/components/common/StatsCard'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Building2, Ticket, Users, Package, LogIn, LogOut, Hourglass } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getErrorMessage } from '@/lib/errors'

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
const dayLabel = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {empty
          ? <p className="py-10 text-center text-sm text-muted-foreground">No entries recorded in this period yet.</p>
          : <ResponsiveContainer width="100%" height={260}>{children}</ResponsiveContainer>}
      </CardContent>
    </Card>
  )
}

export function AdminDashboard() {
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: analyticsApi.overview,
    refetchInterval: 60000,
  })
  const { data: byDate } = useQuery({ queryKey: ['analytics-entries-by-date'], queryFn: () => analyticsApi.entriesByDate(14) })
  const { data: byGate } = useQuery({ queryKey: ['analytics-entries-by-gate'], queryFn: () => analyticsApi.entriesByGate(14) })
  const { data: peak } = useQuery({ queryKey: ['analytics-peak-hours'], queryFn: () => analyticsApi.peakHours(14) })

  if (isLoading) return <LoadingSpinner className="h-64" />
  if (error) return <p className="text-destructive">{getErrorMessage(error, 'Could not load the dashboard.')}</p>

  const fill = 'hsl(var(--primary))'
  return (
    <div className="space-y-6">
      <PageHeader title="Building Dashboard" description="What is happening at the gates right now" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/entries"><StatsCard title="Visitors inside" value={overview?.active_visitors ?? 0} icon={Users} /></Link>
        <Link to="/admin/passes"><StatsCard title="Passes awaiting approval" value={overview?.pending_passes ?? 0} icon={Hourglass} /></Link>
        <Link to="/admin/deliveries"><StatsCard title="Open deliveries" value={overview?.pending_deliveries ?? 0} icon={Package} /></Link>
        <Link to="/admin/companies"><StatsCard title="Active companies" value={overview?.total_companies ?? 0} icon={Building2} /></Link>
        <StatsCard title="Checked in today" value={overview?.checked_in_today ?? 0} icon={LogIn} />
        <StatsCard title="Checked out today" value={overview?.checked_out_today ?? 0} icon={LogOut} />
        <StatsCard title="Passes created today" value={overview?.total_passes_today ?? 0} icon={Ticket} />
      </div>
      <ChartCard title="Entries per day (last 14 days)" empty={!byDate?.length}>
        <BarChart data={byDate}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={dayLabel} fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip labelFormatter={dayLabel} />
          <Bar dataKey="count" name="Entries" style={{ fill }} isAnimationActive={false} maxBarSize={56} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Busiest hours (last 14 days)" empty={!peak?.length}>
          <BarChart data={peak}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={hourLabel} fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip labelFormatter={(h) => hourLabel(Number(h))} />
            <Bar dataKey="count" name="Entries" style={{ fill }} isAnimationActive={false} maxBarSize={56} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Entries by gate (last 14 days)" empty={!byGate?.length}>
          <BarChart data={byGate?.map((g) => ({ ...g, gate: g.gate__name ?? 'Removed gate' }))} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} fontSize={12} />
            <YAxis type="category" dataKey="gate" width={110} fontSize={12} />
            <Tooltip />
            <Bar dataKey="count" name="Entries" style={{ fill }} isAnimationActive={false} maxBarSize={56} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}

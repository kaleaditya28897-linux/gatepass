import { useQuery } from '@tanstack/react-query'
import { deliveriesApi } from '@/api/deliveries'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { Delivery } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function CompanyDeliveriesPage() {
  const { page, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', page],
    queryFn: () => deliveriesApi.list({ page: page.toString() }),
  })

  const columns: ColumnDef<Delivery>[] = [
    { accessorKey: 'employee_name', header: 'Employee' },
    { accessorKey: 'delivery_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.delivery_type.replace('_', ' ')}</Badge> },
    { accessorKey: 'platform_name', header: 'Platform' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} type="delivery" /> },
    { accessorKey: 'expected_at', header: 'Expected', cell: ({ row }) => row.original.expected_at ? formatDateTime(row.original.expected_at) : '-' },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Deliveries" description="Company deliveries" />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

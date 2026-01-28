import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/api/audit'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { AuditLog } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function AuditLogsPage() {
  const { page, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: () => auditApi.list({ page: page.toString() }),
  })

  const columns: ColumnDef<AuditLog>[] = [
    { accessorKey: 'user_name', header: 'User' },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
    { accessorKey: 'resource_type', header: 'Resource' },
    { accessorKey: 'resource_id', header: 'ID' },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'ip_address', header: 'IP' },
    { accessorKey: 'created_at', header: 'Time', cell: ({ row }) => formatDateTime(row.original.created_at) },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Audit Logs" description="System activity logs" />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

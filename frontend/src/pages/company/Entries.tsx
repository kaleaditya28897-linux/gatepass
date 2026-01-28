import { useQuery } from '@tanstack/react-query'
import { entriesApi } from '@/api/entries'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { EntryLog } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function CompanyEntriesPage() {
  const { page, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ['entries', page],
    queryFn: () => entriesApi.list({ page: page.toString() }),
  })

  const columns: ColumnDef<EntryLog>[] = [
    { accessorKey: 'visitor_name', header: 'Name' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'gate_name', header: 'Gate' },
    { accessorKey: 'check_in_time', header: 'Check In', cell: ({ row }) => formatDateTime(row.original.check_in_time) },
    { accessorKey: 'check_out_time', header: 'Check Out', cell: ({ row }) => row.original.check_out_time ? formatDateTime(row.original.check_out_time) : <Badge variant="secondary">Active</Badge> },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Entry Logs" description="Visitor entries for your company" />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

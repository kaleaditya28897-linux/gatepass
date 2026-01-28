import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { VisitorPass } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function AdminPassesPage() {
  const { page, setPage } = usePagination()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['passes', page],
    queryFn: () => passesApi.list({ page: page.toString() }),
  })

  const approveMutation = useMutation({
    mutationFn: passesApi.approve,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passes'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) => passesApi.reject(id, 'Rejected by admin'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passes'] }),
  })

  const columns: ColumnDef<VisitorPass>[] = [
    { accessorKey: 'visitor_name', header: 'Visitor' },
    { accessorKey: 'visitor_phone', header: 'Phone' },
    { accessorKey: 'host_company_name', header: 'Company' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'valid_from', header: 'Valid From', cell: ({ row }) => formatDateTime(row.original.valid_from) },
    { accessorKey: 'valid_until', header: 'Valid Until', cell: ({ row }) => formatDateTime(row.original.valid_until) },
    {
      id: 'actions',
      cell: ({ row }) => row.original.status === 'pending' && (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate(row.original.id)}><Check className="h-4 w-4 text-green-600" /></Button>
          <Button variant="ghost" size="icon" onClick={() => rejectMutation.mutate(row.original.id)}><X className="h-4 w-4 text-red-600" /></Button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Visitor Passes" description="Manage all visitor passes" />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

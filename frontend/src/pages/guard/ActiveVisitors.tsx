import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { entriesApi } from '@/api/entries'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'
import type { EntryLog } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function ActiveVisitorsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['active-entries'],
    queryFn: entriesApi.active,
    refetchInterval: 30000,
  })

  const checkOutMutation = useMutation({
    mutationFn: entriesApi.checkOut,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['active-entries'] }),
  })

  const columns: ColumnDef<EntryLog>[] = [
    { accessorKey: 'visitor_name', header: 'Name' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'company_name', header: 'Company' },
    { accessorKey: 'gate_name', header: 'Gate' },
    { accessorKey: 'check_in_time', header: 'Check In', cell: ({ row }) => formatDateTime(row.original.check_in_time) },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => checkOutMutation.mutate(row.original.id)} disabled={checkOutMutation.isPending}>
          <LogOut className="h-4 w-4 mr-2" /> Check Out
        </Button>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Active Visitors" description="Currently checked-in visitors" />
      <DataTable columns={columns} data={data?.results || []} />
    </div>
  )
}

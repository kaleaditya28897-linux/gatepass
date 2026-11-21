import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { LogOut } from 'lucide-react'
import { entriesApi } from '@/api/entries'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { formatRelative, formatTime } from '@/utils/formatters'
import type { EntryLog } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { Button } from '@/components/ui/button'

export function ActiveVisitorsPage() {
  const queryClient = useQueryClient()
  const list = useList<EntryLog>('active-entries', entriesApi.active, {
    filters: { entry_type: 'visitor' },
    refetchInterval: 30000,
  })

  const checkOut = useMutation({
    mutationFn: entriesApi.checkOut,
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['active-entries'] })
      toast.success(`${entry.visitor_name} checked out.`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const columns: ColumnDef<EntryLog>[] = [
    {
      accessorKey: 'visitor_name', header: 'Visitor',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.visitor_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    { accessorKey: 'company_name', header: 'Visiting' },
    { accessorKey: 'gate_name', header: 'Came in at', cell: ({ row }) => row.original.gate_name || '-' },
    {
      accessorKey: 'check_in_time', header: 'Since',
      cell: ({ row }) => (
        <div>
          <div>{formatTime(row.original.check_in_time)}</div>
          <div className="text-xs text-muted-foreground">{formatRelative(row.original.check_in_time)}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" disabled={checkOut.isPending && checkOut.variables === row.original.id}
            onClick={() => checkOut.mutate(row.original.id)}>
            <LogOut className="h-4 w-4" /> Check out
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Inside Now" description="Visitors currently in the building. Check them out as they leave." />
      <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, phone or company" /></Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No visitors inside right now." />
    </div>
  )
}

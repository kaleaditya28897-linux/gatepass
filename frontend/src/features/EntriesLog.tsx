import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { Download, LogOut } from 'lucide-react'
import { entriesApi } from '@/api/entries'
import { gatesApi } from '@/api/gates'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { formatDateTime } from '@/utils/formatters'
import type { EntryLog } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'

export function EntriesLog({ scope }: { scope: 'admin' | 'company' }) {
  const isAdmin = scope === 'admin'
  const [entryType, setEntryType] = useState('all')
  const [gate, setGate] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [onlyInside, setOnlyInside] = useState(false)
  const [checkingOut, setCheckingOut] = useState<EntryLog | null>(null)
  const [exporting, setExporting] = useState(false)
  const queryClient = useQueryClient()

  const { data: gates } = useQuery({
    queryKey: ['gates', 'all'], queryFn: () => gatesApi.list({ page_size: '100' }), enabled: isAdmin,
  })
  const list = useList<EntryLog>('entries', entriesApi.list, {
    filters: {
      entry_type: entryType, gate, date_from: dateFrom, date_to: dateTo,
      active: onlyInside ? 'true' : undefined,
    },
  })

  const checkOut = useMutation({
    mutationFn: entriesApi.checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      setCheckingOut(null)
      toast.success('Checked out.')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { page: _page, ...filters } = list.params
      void _page
      await entriesApi.exportCsv(filters)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Export failed.'))
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<EntryLog>[] = [
    {
      accessorKey: 'visitor_name', header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.visitor_name || '-'}</div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </div>
      ),
    },
    ...(isAdmin ? [{ accessorKey: 'company_name', header: 'Company' } as ColumnDef<EntryLog>] : []),
    { accessorKey: 'entry_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.entry_type}</Badge> },
    { accessorKey: 'gate_name', header: 'Gate', cell: ({ row }) => row.original.gate_name || '-' },
    { accessorKey: 'check_in_time', header: 'Check in', cell: ({ row }) => formatDateTime(row.original.check_in_time) },
    {
      accessorKey: 'check_out_time', header: 'Check out',
      cell: ({ row }) => row.original.check_out_time ? formatDateTime(row.original.check_out_time) : <Badge variant="secondary">Inside</Badge>,
    },
    { accessorKey: 'checked_in_by_name', header: 'Guard', cell: ({ row }) => row.original.checked_in_by_name || '-' },
    ...(isAdmin ? [{
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => !row.original.check_out_time && (
        <Button variant="outline" size="sm" onClick={() => setCheckingOut(row.original)}>
          <LogOut className="h-4 w-4" /> Check out
        </Button>
      ),
    } as ColumnDef<EntryLog>] : []),
  ]

  return (
    <div>
      <PageHeader
        title="Entry Log"
        description={isAdmin ? 'Every entry and exit recorded at the gates' : 'Visitors and deliveries for your company'}
        action={isAdmin && (
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? 'Preparing…' : 'Export CSV'}
          </Button>
        )}
      />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, phone or company" />
        <NativeSelect aria-label="Filter by type" className="sm:w-36" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
          <option value="all">All types</option>
          <option value="visitor">Visitors</option>
          <option value="delivery">Deliveries</option>
        </NativeSelect>
        {isAdmin && (
          <NativeSelect aria-label="Filter by gate" className="sm:w-40" value={gate} onChange={(e) => setGate(e.target.value)}>
            <option value="all">All gates</option>
            {gates?.results.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </NativeSelect>
        )}
        <Input aria-label="From date" type="date" className="sm:w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input aria-label="To date" type="date" className="sm:w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" className="h-4 w-4" checked={onlyInside} onChange={(e) => setOnlyInside(e.target.checked)} />
          Still inside
        </label>
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No entries match." />
      <ConfirmDialog
        open={!!checkingOut}
        title="Check this entry out?"
        description={checkingOut ? `Marks ${checkingOut.visitor_name} as having left the building now.` : undefined}
        confirmLabel="Check out"
        pending={checkOut.isPending}
        onCancel={() => setCheckingOut(null)}
        onConfirm={() => checkingOut && checkOut.mutate(checkingOut.id)}
      />
    </div>
  )
}

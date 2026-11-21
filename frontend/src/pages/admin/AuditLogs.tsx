import { ColumnDef } from '@tanstack/react-table'
import { auditApi } from '@/api/audit'
import { tableProps, useList } from '@/hooks/useList'
import { formatDateTime, titleCase } from '@/utils/formatters'
import type { AuditLog } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { Badge } from '@/components/ui/badge'

export function AuditLogsPage() {
  const list = useList<AuditLog>('audit-logs', auditApi.list)

  const columns: ColumnDef<AuditLog>[] = [
    { accessorKey: 'created_at', header: 'Time', cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.created_at)}</span> },
    { accessorKey: 'user_name', header: 'User', cell: ({ row }) => row.original.user_name || '-' },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline" className="whitespace-nowrap">{titleCase(row.original.action)}</Badge> },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'ip_address', header: 'IP address', cell: ({ row }) => row.original.ip_address || '-' },
  ]

  return (
    <div>
      <PageHeader title="Audit Log" description="Who did what, and when" />
      <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search descriptions" /></Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="Nothing logged yet." />
    </div>
  )
}

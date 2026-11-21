import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

interface DataTableProps<TData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  data: TData[]
  pageCount?: number
  page?: number
  total?: number
  onPageChange?: (page: number) => void
  loading?: boolean
  error?: string | null
  emptyMessage?: string
}

export function DataTable<TData>({
  columns, data, pageCount = 0, page = 1, total, onPageChange, loading, error, emptyMessage = 'Nothing to show yet.',
}: DataTableProps<TData>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true })
  const rows = table.getRowModel().rows

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} className="h-24"><LoadingSpinner /></TableCell></TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-destructive">{error}</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(pageCount > 1 || total !== undefined) && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {total !== undefined ? `${total} ${total === 1 ? 'record' : 'records'}` : ''}
          </span>
          {pageCount > 1 && onPageChange && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

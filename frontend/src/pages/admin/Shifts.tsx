import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { gatesApi, guardsApi, shiftsApi } from '@/api/gates'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { shiftSchema, ShiftInput } from '@/utils/validators'
import { formatDateTime, localInputToIso, toLocalInput } from '@/utils/formatters'
import type { GuardShift } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function ShiftsPage() {
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<GuardShift | null>(null)
  const [showPast, setShowPast] = useState(false)
  const queryClient = useQueryClient()
  const list = useList<GuardShift>('shifts', shiftsApi.list, { filters: { upcoming: showPast ? undefined : '1' } })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shifts'] })

  const remove = useMutation({
    mutationFn: shiftsApi.delete,
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Shift removed.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const now = Date.now()
  const columns: ColumnDef<GuardShift>[] = [
    { accessorKey: 'guard_name', header: 'Guard', cell: ({ row }) => <span className="font-medium">{row.original.guard_name}</span> },
    { accessorKey: 'gate_name', header: 'Gate' },
    { accessorKey: 'shift_start', header: 'Starts', cell: ({ row }) => formatDateTime(row.original.shift_start) },
    { accessorKey: 'shift_end', header: 'Ends', cell: ({ row }) => formatDateTime(row.original.shift_end) },
    {
      id: 'state', header: 'Status',
      cell: ({ row }) => {
        const start = new Date(row.original.shift_start).getTime()
        const end = new Date(row.original.shift_end).getTime()
        if (end < now) return <Badge variant="secondary">Finished</Badge>
        if (start <= now) return <Badge>On now</Badge>
        return <Badge variant="outline">Upcoming</Badge>
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" aria-label="Remove shift" onClick={() => setDeleting(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Guard Shifts"
        description="Optional roster. A guard on shift gets their gate selected automatically; otherwise they pick the gate themselves."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Shift</Button>}
      />
      <Toolbar>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Show finished shifts
        </label>
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No shifts scheduled." />
      {creating && <ShiftDialog onClose={() => setCreating(false)} onDone={() => { refresh(); setCreating(false) }} />}
      <ConfirmDialog
        open={!!deleting}
        title="Remove this shift?"
        description={deleting ? `${deleting.guard_name} at ${deleting.gate_name}, ${formatDateTime(deleting.shift_start)}.` : undefined}
        confirmLabel="Remove shift"
        destructive
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function ShiftDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  const { register, handleSubmit, formState: { errors } } = useForm<ShiftInput>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      shift_start: toLocalInput(start),
      shift_end: toLocalInput(new Date(start.getTime() + 8 * 60 * 60 * 1000)),
    },
  })
  const { data: guards } = useQuery({ queryKey: ['guards', 'all'], queryFn: () => guardsApi.list({ page_size: '100', is_active: 'true' }) })
  const { data: gates } = useQuery({ queryKey: ['gates', 'all-active'], queryFn: () => gatesApi.list({ page_size: '100', is_active: 'true' }) })
  const create = useMutation({
    mutationFn: (d: ShiftInput) => shiftsApi.create({
      guard: d.guard, gate: d.gate,
      shift_start: localInputToIso(d.shift_start), shift_end: localInputToIso(d.shift_end),
    }),
    onSuccess: () => { toast.success('Shift added.'); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add shift</DialogTitle>
          <DialogDescription>Assign a guard to a gate for a period of time.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <FormField label="Guard" required error={errors.guard?.message}>
            <NativeSelect {...register('guard')}>
              <option value="">Select guard…</option>
              {guards?.results.map((g) => <option key={g.id} value={g.id}>{g.full_name || g.username} ({g.badge_number})</option>)}
            </NativeSelect>
          </FormField>
          <FormField label="Gate" required error={errors.gate?.message}>
            <NativeSelect {...register('gate')}>
              <option value="">Select gate…</option>
              {gates?.results.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Starts" required error={errors.shift_start?.message}><Input type="datetime-local" {...register('shift_start')} /></FormField>
            <FormField label="Ends" required error={errors.shift_end?.message}><Input type="datetime-local" {...register('shift_end')} /></FormField>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>Add shift</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

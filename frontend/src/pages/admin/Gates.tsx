import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { gatesApi } from '@/api/gates'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { gateSchema, GateInput } from '@/utils/validators'
import { GATE_TYPES } from '@/utils/constants'
import type { Gate } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function GatesPage() {
  const [editing, setEditing] = useState<Gate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Gate | null>(null)
  const queryClient = useQueryClient()
  const list = useList<Gate>('gates', gatesApi.list)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gates'] })

  const remove = useMutation({
    mutationFn: gatesApi.delete,
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Gate deleted.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const columns: ColumnDef<Gate>[] = [
    { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => row.original.location || '-' },
    { accessorKey: 'gate_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.gate_type}</Badge> },
    { accessorKey: 'is_active', header: 'Status', cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Closed'}</Badge> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`} onClick={() => setDeleting(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Gates"
        description="Entry and exit points guards can be posted at"
        action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add Gate</Button>}
      />
      <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search gates" /></Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No gates yet. Add at least one so guards can check visitors in." />
      {editing && <GateDialog gate={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { refresh(); setEditing(null) }} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="Its shifts are removed. Past entries stay in the log without a gate name. To pause a gate, mark it closed instead."
        confirmLabel="Delete gate"
        destructive
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function GateDialog({ gate, onClose, onDone }: { gate: Gate | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GateInput>({
    resolver: zodResolver(gateSchema),
    defaultValues: { gate_type: 'pedestrian', is_active: true },
  })
  useEffect(() => {
    if (gate) reset({ name: gate.name, code: gate.code, location: gate.location, gate_type: gate.gate_type, is_active: gate.is_active })
  }, [gate, reset])
  const save = useMutation({
    mutationFn: (data: GateInput) => gate ? gatesApi.update(gate.id, data) : gatesApi.create(data),
    onSuccess: (g) => { toast.success(`${g.name} saved.`); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gate ? `Edit ${gate.name}` : 'Add gate'}</DialogTitle>
          <DialogDescription>Guards choose one of these when they start work.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3" noValidate>
          <FormField label="Name" required error={errors.name?.message}><Input placeholder="Main Entrance" {...register('name')} /></FormField>
          <FormField label="Code" required error={errors.code?.message}><Input placeholder="GATE-A" {...register('code')} /></FormField>
          <FormField label="Location"><Input placeholder="Ground floor lobby" {...register('location')} /></FormField>
          <FormField label="Type">
            <NativeSelect {...register('gate_type')}>
              {GATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </NativeSelect>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register('is_active')} />
            Open (guards can check visitors in here)
          </label>
          <Button type="submit" className="w-full" disabled={save.isPending}>Save gate</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

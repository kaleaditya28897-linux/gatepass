import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { guardsApi } from '@/api/gates'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { guardCreateSchema, GuardCreateInput, guardEditSchema, GuardEditInput } from '@/utils/validators'
import type { Guard } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function GuardsPage() {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Guard | null>(null)
  const [deleting, setDeleting] = useState<Guard | null>(null)
  const queryClient = useQueryClient()
  const list = useList<Guard>('guards', guardsApi.list)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['guards'] })

  const remove = useMutation({
    mutationFn: guardsApi.delete,
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Guard removed.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const columns: ColumnDef<Guard>[] = [
    {
      accessorKey: 'full_name', header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.full_name || row.original.username}</div>
          <div className="text-xs text-muted-foreground">{row.original.username}</div>
        </div>
      ),
    },
    { accessorKey: 'badge_number', header: 'Badge #' },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || '-' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || '-' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Disabled'}</Badge> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.username}`} onClick={() => setEditing(row.original)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${row.original.username}`} onClick={() => setDeleting(row.original)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Guards"
        description="Security staff who check visitors and deliveries in at the gates"
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Guard</Button>}
      />
      <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name or badge" /></Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No guards yet." />
      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={() => { refresh(); setCreating(false) }} />}
      {editing && <EditDialog guard={editing} onClose={() => setEditing(null)} onDone={() => { refresh(); setEditing(null) }} />}
      <ConfirmDialog
        open={!!deleting}
        title="Remove this guard?"
        description={deleting ? `${deleting.full_name || deleting.username}'s login and shifts are deleted. To keep their name on past entries, disable the account instead (Edit).` : undefined}
        confirmLabel="Remove guard"
        destructive
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<GuardCreateInput>({ resolver: zodResolver(guardCreateSchema) })
  const create = useMutation({
    mutationFn: guardsApi.create,
    onSuccess: (g) => { toast.success(`${g.full_name || g.username} added.`); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add guard</DialogTitle>
          <DialogDescription>Creates a login for the gate tablet or the guard's phone.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} /></FormField>
            <FormField label="Last name"><Input {...register('last_name')} /></FormField>
            <FormField label="Username" required error={errors.username?.message}><Input autoComplete="off" {...register('username')} /></FormField>
            <FormField label="Temporary password" required error={errors.password?.message}>
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </FormField>
            <FormField label="Badge number" required error={errors.badge_number?.message}><Input {...register('badge_number')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></FormField>
          </div>
          <FormField label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add guard'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ guard, onClose, onDone }: { guard: Guard; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GuardEditInput>({ resolver: zodResolver(guardEditSchema) })
  useEffect(() => {
    reset({
      first_name: guard.first_name, last_name: guard.last_name, email: guard.email, phone: guard.phone,
      badge_number: guard.badge_number, is_active: guard.is_active,
    })
  }, [guard, reset])
  const update = useMutation({
    mutationFn: (data: GuardEditInput) => guardsApi.update(guard.id, data),
    onSuccess: () => { toast.success('Guard updated.'); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {guard.username}</DialogTitle>
          <DialogDescription>Reset their password from the Users page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} /></FormField>
            <FormField label="Last name"><Input {...register('last_name')} /></FormField>
            <FormField label="Badge number" required error={errors.badge_number?.message}><Input {...register('badge_number')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></FormField>
          </div>
          <FormField label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register('is_active')} />
            Account active (can sign in)
          </label>
          <Button type="submit" className="w-full" disabled={update.isPending}>Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

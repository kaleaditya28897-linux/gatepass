import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { KeyRound, Plus, UserCheck, UserX } from 'lucide-react'
import { usersApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { setPasswordSchema, SetPasswordInput, userCreateSchema, UserCreateInput } from '@/utils/validators'
import { ROLE_LABELS } from '@/utils/constants'
import { formatDateTime } from '@/utils/formatters'
import type { ManagedUser } from '@/types'
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

export function UsersPage() {
  const me = useAuthStore((s) => s.user)
  const [role, setRole] = useState('all')
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const [toggling, setToggling] = useState<ManagedUser | null>(null)
  const queryClient = useQueryClient()
  const list = useList<ManagedUser>('users', usersApi.list, { filters: { role } })
  const refresh = () => {
    for (const key of ['users', 'employees', 'guards', 'companies']) queryClient.invalidateQueries({ queryKey: [key] })
  }

  const toggle = useMutation({
    mutationFn: (u: ManagedUser) => usersApi.update(u.id, { is_active: !u.is_active }),
    onSuccess: (u) => { refresh(); setToggling(null); toast.success(`${u.username} ${u.is_active ? 'enabled' : 'disabled'}.`) },
    onError: (e) => { setToggling(null); toast.error(getErrorMessage(e)) },
  })

  const columns: ColumnDef<ManagedUser>[] = [
    {
      accessorKey: 'username', header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{[row.original.first_name, row.original.last_name].filter(Boolean).join(' ') || row.original.username}</div>
          <div className="text-xs text-muted-foreground">{row.original.username}</div>
        </div>
      ),
    },
    { accessorKey: 'role', header: 'Role', cell: ({ row }) => <Badge variant="outline">{ROLE_LABELS[row.original.role]}</Badge> },
    { id: 'company', header: 'Company', cell: ({ row }) => row.original.company?.name ?? '-' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || '-' },
    { accessorKey: 'last_login', header: 'Last sign-in', cell: ({ row }) => row.original.last_login ? formatDateTime(row.original.last_login) : 'Never' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Disabled'}</Badge> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Reset password" aria-label={`Reset password for ${u.username}`} onClick={() => setResetting(u)}>
              <KeyRound className="h-4 w-4" />
            </Button>
            {u.id !== me?.id && (
              <Button variant="ghost" size="icon" title={u.is_active ? 'Disable account' : 'Enable account'}
                aria-label={`${u.is_active ? 'Disable' : 'Enable'} ${u.username}`} onClick={() => setToggling(u)}>
                {u.is_active ? <UserX className="h-4 w-4 text-red-600" /> : <UserCheck className="h-4 w-4 text-green-600" />}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every login in the system. Reset passwords and disable accounts here."
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Admin</Button>}
      />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, username or email" />
        <NativeSelect aria-label="Filter by role" className="sm:w-48" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} />
      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={() => { refresh(); setCreating(false) }} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.is_active ? `Disable ${toggling.username}?` : `Enable ${toggling?.username}?`}
        description={toggling?.is_active
          ? 'They will be signed out and unable to sign in until the account is enabled again.'
          : 'They will be able to sign in again.'}
        confirmLabel={toggling?.is_active ? 'Disable account' : 'Enable account'}
        destructive={toggling?.is_active}
        pending={toggle.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() => toggling && toggle.mutate(toggling)}
      />
    </div>
  )
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { role: 'admin' },
  })
  const create = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (u) => { toast.success(`${u.username} created.`); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add admin account</DialogTitle>
          <DialogDescription>
            Building admins manage everything. Company admins are linked to a tenant on the Companies page.
            Employees and guards are added from their own pages.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
          <FormField label="Role">
            <NativeSelect {...register('role')}>
              <option value="admin">Building admin</option>
              <option value="company">Company admin</option>
            </NativeSelect>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} /></FormField>
            <FormField label="Last name"><Input {...register('last_name')} /></FormField>
            <FormField label="Username" required error={errors.username?.message}><Input autoComplete="off" {...register('username')} /></FormField>
            <FormField label="Temporary password" required error={errors.password?.message}>
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </FormField>
            <FormField label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></FormField>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>Create account</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<SetPasswordInput>({ resolver: zodResolver(setPasswordSchema) })
  const reset = useMutation({
    mutationFn: (d: SetPasswordInput) => usersApi.setPassword(user.id, d.new_password),
    onSuccess: () => { toast.success(`Password for ${user.username} updated.`); onClose() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {user.username} and pass it on to them securely.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => reset.mutate(d))} className="space-y-3" noValidate>
          <FormField label="New password" required error={errors.new_password?.message}>
            <Input type="password" autoComplete="new-password" {...register('new_password')} />
          </FormField>
          <FormField label="Confirm new password" required error={errors.confirm_password?.message}>
            <Input type="password" autoComplete="new-password" {...register('confirm_password')} />
          </FormField>
          <Button type="submit" className="w-full" disabled={reset.isPending}>Set password</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

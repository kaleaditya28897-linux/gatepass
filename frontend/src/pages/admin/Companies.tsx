import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { companiesApi } from '@/api/companies'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { companySchema, CompanyInput } from '@/utils/validators'
import type { Company } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const slugify = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function CompaniesPage() {
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const list = useList<Company>('companies', companiesApi.list)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['companies'] })
    queryClient.invalidateQueries({ queryKey: ['company-directory'] })
    queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
  }

  const remove = useMutation({
    mutationFn: companiesApi.delete,
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Company deleted.') },
    onError: (e) => { setDeleting(null); toast.error(getErrorMessage(e)) },
  })

  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: 'name', header: 'Company',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email || row.original.slug}</div>
        </div>
      ),
    },
    {
      id: 'location', header: 'Location',
      cell: ({ row }) => [row.original.floor, row.original.suite_number && `Suite ${row.original.suite_number}`].filter(Boolean).join(', ') || '-',
    },
    {
      accessorKey: 'admin_name', header: 'Company admin',
      cell: ({ row }) => row.original.admin_username
        ? <div><div>{row.original.admin_name}</div><div className="text-xs text-muted-foreground">{row.original.admin_username}</div></div>
        : <Badge variant="destructive">No admin</Badge>,
    },
    { id: 'employees', header: 'Employees', cell: ({ row }) => `${row.original.employee_count} / ${row.original.max_employees}` },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={() => setEditing(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`} onClick={() => setDeleting(row.original)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Tenant companies in the building"
        action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add Company</Button>}
      />
      <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search companies" /></Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No companies yet. Add your first tenant." />
      {editing && (
        <CompanyDialog
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { refresh(); setEditing(null) }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="Only companies with no employees or visit history can be deleted. Otherwise mark the company inactive."
        confirmLabel="Delete company"
        destructive
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function CompanyDialog({ company, onClose, onDone }: { company: Company | null; onClose: () => void; onDone: () => void }) {
  const needsAdmin = !company?.admin_username
  const { register, handleSubmit, reset, setValue, getFieldState, formState: { errors } } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: { max_employees: 50, is_active: true },
  })
  useEffect(() => {
    if (company) {
      reset({
        name: company.name, slug: company.slug, email: company.email, phone: company.phone,
        floor: company.floor, suite_number: company.suite_number,
        max_employees: company.max_employees, is_active: company.is_active,
      })
    }
  }, [company, reset])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      company ? companiesApi.update(company.id, payload) : companiesApi.create(payload),
    onSuccess: (c) => { toast.success(`${c.name} saved.`); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const onSubmit = (data: CompanyInput) => {
    const { admin_username, admin_first_name, admin_last_name, admin_email, admin_password, ...fields } = data
    const payload: Record<string, unknown> = { ...fields }
    if (needsAdmin && admin_username) {
      payload.admin_account = {
        username: admin_username, password: admin_password, first_name: admin_first_name,
        last_name: admin_last_name ?? '', email: admin_email ?? '',
      }
    }
    save.mutate(payload)
  }

  const nameField = register('name')
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? `Edit ${company.name}` : 'Add company'}</DialogTitle>
          <DialogDescription>Tenant details and the person who manages its employees and passes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Company name" required error={errors.name?.message}>
            <Input
              {...nameField}
              onChange={(e) => {
                nameField.onChange(e)
                if (!company && !getFieldState('slug').isDirty) setValue('slug', slugify(e.target.value))
              }}
            />
          </FormField>
          <FormField label="Short code" required error={errors.slug?.message} hint="Used internally; lowercase letters, numbers and dashes.">
            <Input {...register('slug')} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Floor"><Input {...register('floor')} /></FormField>
            <FormField label="Suite"><Input {...register('suite_number')} /></FormField>
            <FormField label="Max employees" error={errors.max_employees?.message}>
              <Input type="number" min={1} {...register('max_employees')} />
            </FormField>
            <FormField label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register('is_active')} />
            Active (can host visitors and receive deliveries)
          </label>
          <Separator />
          {needsAdmin ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Company admin login</h3>
                <p className="text-xs text-muted-foreground">
                  The tenant's own administrator. Leave blank to add one later.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Username" error={errors.admin_username?.message}><Input autoComplete="off" {...register('admin_username')} /></FormField>
                <FormField label="Temporary password" error={errors.admin_password?.message}>
                  <Input type="password" autoComplete="new-password" {...register('admin_password')} />
                </FormField>
                <FormField label="First name" error={errors.admin_first_name?.message}><Input {...register('admin_first_name')} /></FormField>
                <FormField label="Last name"><Input {...register('admin_last_name')} /></FormField>
              </div>
              <FormField label="Admin email" error={errors.admin_email?.message}><Input type="email" {...register('admin_email')} /></FormField>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Company admin: <span className="font-medium text-foreground">{company?.admin_name}</span> ({company?.admin_username}).
              Reset their password from the Users page.
            </p>
          )}
          <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save company'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

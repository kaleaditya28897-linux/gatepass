import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { BulkUploadResult, companiesApi, employeesApi } from '@/api/companies'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import {
  employeeCreateSchema, EmployeeCreateInput, employeeEditSchema, EmployeeEditInput,
} from '@/utils/validators'
import type { Employee } from '@/types'
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

type Scope = 'admin' | 'company'

const CSV_TEMPLATE =
  'username,email,first_name,last_name,password,phone,employee_id,designation,department\n' +
  'priya.shah,priya@example.com,Priya,Shah,ChangeMe-2026!,+919800000000,EMP001,Analyst,Finance\n'

export function EmployeesManager({ scope }: { scope: Scope }) {
  const [company, setCompany] = useState('all')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const queryClient = useQueryClient()

  const { data: companies } = useQuery({
    queryKey: ['company-directory'], queryFn: companiesApi.directory, enabled: scope === 'admin',
  })
  const list = useList<Employee>('employees', employeesApi.list, {
    filters: scope === 'admin' ? { company } : undefined,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] })
    queryClient.invalidateQueries({ queryKey: ['employee-directory'] })
    queryClient.invalidateQueries({ queryKey: ['companies'] })
    queryClient.invalidateQueries({ queryKey: ['company-stats'] })
  }

  const remove = useMutation({
    mutationFn: employeesApi.delete,
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Employee removed.') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const columns: ColumnDef<Employee>[] = [
    {
      id: 'name', header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.first_name} {row.original.last_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.username}</div>
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || '-' },
    ...(scope === 'admin' ? [{ accessorKey: 'company_name', header: 'Company' } as ColumnDef<Employee>] : []),
    { accessorKey: 'employee_id', header: 'Employee ID', cell: ({ row }) => row.original.employee_id || '-' },
    { accessorKey: 'department', header: 'Department', cell: ({ row }) => row.original.department || '-' },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Disabled'}</Badge>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.username}`} onClick={() => setEditing(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${row.original.username}`} onClick={() => setDeleting(row.original)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Employees"
        description={scope === 'admin' ? 'Employees across all companies' : 'People in your company who can invite visitors'}
        action={
          <>
            <Button variant="outline" onClick={() => setUploading(true)}><Upload className="h-4 w-4" /> Bulk upload</Button>
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Employee</Button>
          </>
        }
      />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search name, email or ID" />
        {scope === 'admin' && (
          <NativeSelect aria-label="Filter by company" className="sm:w-56" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="all">All companies</option>
            {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        )}
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No employees yet." />

      {creating && <CreateDialog scope={scope} onClose={() => setCreating(false)} onDone={() => { refresh(); setCreating(false) }} />}
      {editing && <EditDialog employee={editing} onClose={() => setEditing(null)} onDone={() => { refresh(); setEditing(null) }} />}
      {uploading && <BulkUploadDialog scope={scope} onClose={() => setUploading(false)} onDone={refresh} />}
      <ConfirmDialog
        open={!!deleting}
        title="Remove this employee?"
        description={deleting ? `${deleting.first_name} ${deleting.last_name}'s login and their pending deliveries are deleted. To keep their history, disable the account instead (Edit).` : undefined}
        confirmLabel="Remove employee"
        destructive
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  )
}

function CreateDialog({ scope, onClose, onDone }: { scope: Scope; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<EmployeeCreateInput>({
    resolver: zodResolver(employeeCreateSchema),
  })
  const { data: companies } = useQuery({
    queryKey: ['company-directory'], queryFn: companiesApi.directory, enabled: scope === 'admin',
  })
  const create = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: (e) => { toast.success(`${e.first_name} ${e.last_name} added.`); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const onSubmit = (data: EmployeeCreateInput) => {
    if (scope === 'admin' && !data.company) {
      setError('company', { message: 'Choose a company' })
      return
    }
    create.mutate({ ...data, company: scope === 'admin' ? data.company : undefined })
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>Creates a login the employee uses to invite visitors and track deliveries.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {scope === 'admin' && (
            <FormField label="Company" required error={errors.company?.message}>
              <NativeSelect {...register('company')}>
                <option value="">Select company…</option>
                {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} /></FormField>
            <FormField label="Last name" required error={errors.last_name?.message}><Input {...register('last_name')} /></FormField>
            <FormField label="Username" required error={errors.username?.message}><Input autoComplete="off" {...register('username')} /></FormField>
            <FormField label="Temporary password" required error={errors.password?.message} hint="They can change it after signing in.">
              <Input type="password" autoComplete="new-password" {...register('password')} />
            </FormField>
            <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" placeholder="+91…" {...register('phone')} /></FormField>
            <FormField label="Employee ID"><Input {...register('employee_id')} /></FormField>
            <FormField label="Department"><Input {...register('department')} /></FormField>
          </div>
          <FormField label="Designation"><Input {...register('designation')} /></FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add employee'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditDialog({ employee, onClose, onDone }: { employee: Employee; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeEditInput>({
    resolver: zodResolver(employeeEditSchema),
  })
  useEffect(() => {
    reset({
      first_name: employee.first_name, last_name: employee.last_name, email: employee.email,
      phone: employee.phone, employee_id: employee.employee_id, designation: employee.designation,
      department: employee.department, is_active: employee.is_active,
    })
  }, [employee, reset])
  const update = useMutation({
    mutationFn: (data: EmployeeEditInput) => employeesApi.update(employee.id, data),
    onSuccess: () => { toast.success('Employee updated.'); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {employee.username}</DialogTitle>
          <DialogDescription>{employee.company_name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => update.mutate(d))} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="First name" required error={errors.first_name?.message}><Input {...register('first_name')} /></FormField>
            <FormField label="Last name" required error={errors.last_name?.message}><Input {...register('last_name')} /></FormField>
            <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register('email')} /></FormField>
            <FormField label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></FormField>
            <FormField label="Employee ID"><Input {...register('employee_id')} /></FormField>
            <FormField label="Department"><Input {...register('department')} /></FormField>
          </div>
          <FormField label="Designation"><Input {...register('designation')} /></FormField>
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

function BulkUploadDialog({ scope, onClose, onDone }: { scope: Scope; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState('')
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const { data: companies } = useQuery({
    queryKey: ['company-directory'], queryFn: companiesApi.directory, enabled: scope === 'admin',
  })
  const upload = useMutation({
    mutationFn: (file: File) => employeesApi.bulkUpload(file, companyId ? Number(companyId) : undefined),
    onSuccess: (r) => {
      setResult(r)
      onDone()
      if (r.created) toast.success(`${r.created} employee${r.created === 1 ? '' : 's'} added.`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return toast.error('Choose a CSV file first.')
    if (scope === 'admin' && !companyId) return toast.error('Choose a company first.')
    upload.mutate(file)
  }
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk upload employees</DialogTitle>
          <DialogDescription>
            Upload a CSV with the columns username, email, first_name, last_name and password
            (phone, employee_id, designation and department are optional).{' '}
            <a className="underline" href={templateHref} download="gatepass-employees-template.csv">Download a template</a>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {scope === 'admin' && (
            <FormField label="Company" required>
              <NativeSelect value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">Select company…</option>
                {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="CSV file" required>
            <Input ref={fileRef} type="file" accept=".csv,text/csv" />
          </FormField>
          <Button className="w-full" onClick={submit} disabled={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
          {result && (
            <div className="rounded-md border p-3 text-sm space-y-2" role="status">
              <p className="font-medium">{result.created} added, {result.errors.length} skipped</p>
              {result.errors.length > 0 && (
                <ul className="max-h-48 overflow-y-auto space-y-1 text-destructive">
                  {result.errors.map((e) => (
                    <li key={e.row}>Row {e.row}{e.username ? ` (${e.username})` : ''}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

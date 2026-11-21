import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Ban, Check, Copy, Eye, Plus, X } from 'lucide-react'
import { passesApi } from '@/api/passes'
import { companiesApi, employeesApi } from '@/api/companies'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { passSchema, PassInput } from '@/utils/validators'
import { formatDateTime, localInputToIso, titleCase, toLocalInput } from '@/utils/formatters'
import { PASS_STATUSES } from '@/utils/constants'
import type { VisitorPass } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Scope = 'admin' | 'company' | 'employee'

const COPY: Record<Scope, { title: string; description: string }> = {
  admin: { title: 'Visitor Passes', description: 'All visitor passes in the building' },
  company: { title: 'Visitor Passes', description: 'Approve and manage visitor passes for your company' },
  employee: { title: 'My Visitor Passes', description: 'Invite visitors and share their pass' },
}

export function PassesManager({ scope }: { scope: Scope }) {
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<VisitorPass | null>(null)
  const [rejecting, setRejecting] = useState<VisitorPass | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelling, setCancelling] = useState<VisitorPass | null>(null)
  const queryClient = useQueryClient()
  const canApprove = scope !== 'employee'

  const list = useList<VisitorPass>('passes', passesApi.list, { filters: { status } })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['passes'] })
    queryClient.invalidateQueries({ queryKey: ['company-stats'] })
    queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
  }
  const onError = (e: unknown) => toast.error(getErrorMessage(e))

  const approve = useMutation({
    mutationFn: passesApi.approve,
    onSuccess: (p) => { refresh(); toast.success(`Pass for ${p.visitor_name} approved.`) },
    onError,
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => passesApi.reject(id, reason),
    onSuccess: () => { refresh(); setRejecting(null); setRejectReason(''); toast.success('Pass rejected.') },
    onError,
  })
  const cancel = useMutation({
    mutationFn: passesApi.cancel,
    onSuccess: () => { refresh(); setCancelling(null); setViewing(null); toast.success('Pass cancelled.') },
    onError,
  })

  const columns: ColumnDef<VisitorPass>[] = [
    {
      accessorKey: 'visitor_name', header: 'Visitor',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.visitor_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.visitor_phone}</div>
        </div>
      ),
    },
    ...(scope === 'admin' ? [{ accessorKey: 'host_company_name', header: 'Company' } as ColumnDef<VisitorPass>] : []),
    ...(scope !== 'employee'
      ? [{ accessorKey: 'host_employee_name', header: 'Host', cell: ({ row }) => row.original.host_employee_name || '-' } as ColumnDef<VisitorPass>]
      : [{ accessorKey: 'purpose', header: 'Purpose', cell: ({ row }) => row.original.purpose || '-' } as ColumnDef<VisitorPass>]),
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'valid_from', header: 'Valid from', cell: ({ row }) => formatDateTime(row.original.valid_from) },
    { accessorKey: 'valid_until', header: 'Valid until', cell: ({ row }) => formatDateTime(row.original.valid_until) },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex justify-end gap-1">
            {canApprove && p.status === 'pending' && (
              <>
                <Button variant="ghost" size="icon" title="Approve" aria-label={`Approve pass for ${p.visitor_name}`}
                  disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" title="Reject" aria-label={`Reject pass for ${p.visitor_name}`}
                  onClick={() => setRejecting(p)}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" title="View pass" aria-label={`View pass for ${p.visitor_name}`}
              onClick={() => setViewing(p)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title={COPY[scope].title}
        description={COPY[scope].description}
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Pass</Button>}
      />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search visitor name or phone" />
        <NativeSelect aria-label="Filter by status" className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {PASS_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </NativeSelect>
      </Toolbar>
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No passes match." />

      {creating && <PassFormDialog scope={scope} onClose={() => setCreating(false)} onCreated={(p) => { refresh(); setCreating(false); setViewing(p) }} />}

      <PassDetailDialog
        pass={viewing}
        onClose={() => setViewing(null)}
        onCancel={(p) => setCancelling(p)}
      />

      <ConfirmDialog
        open={!!rejecting}
        title="Reject this pass?"
        description={rejecting ? `${rejecting.visitor_name} will not be allowed in with this pass.` : undefined}
        confirmLabel="Reject pass"
        destructive
        pending={reject.isPending}
        onCancel={() => { setRejecting(null); setRejectReason('') }}
        onConfirm={() => rejecting && reject.mutate({ id: rejecting.id, reason: rejectReason.trim() })}
      >
        <FormField label="Reason (shown to the host)">
          <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={300} />
        </FormField>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this pass?"
        description={cancelling ? `${cancelling.visitor_name} will no longer be able to enter with it.` : undefined}
        confirmLabel="Cancel pass"
        destructive
        pending={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </div>
  )
}

function PassFormDialog({ scope, onClose, onCreated }: {
  scope: Scope
  onClose: () => void
  onCreated: (pass: VisitorPass) => void
}) {
  const user = useAuthStore((s) => s.user)
  const now = new Date()
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PassInput>({
    resolver: zodResolver(passSchema),
    defaultValues: {
      pass_type: 'pre_approved',
      valid_from: toLocalInput(now),
      valid_until: toLocalInput(new Date(now.getTime() + 4 * 60 * 60 * 1000)),
    },
  })

  const { data: companies } = useQuery({
    queryKey: ['company-directory'], queryFn: companiesApi.directory, enabled: scope === 'admin',
  })
  const selectedCompany = scope === 'admin' ? Number(watch('host_company')) || undefined : user?.company?.id
  const { data: employees } = useQuery({
    queryKey: ['employee-directory', selectedCompany],
    queryFn: () => employeesApi.directory(scope === 'admin' ? selectedCompany : undefined),
    enabled: scope !== 'employee' && !!selectedCompany,
  })
  useEffect(() => { if (scope === 'admin') setValue('host_employee', undefined) }, [selectedCompany, scope, setValue])

  const create = useMutation({
    mutationFn: passesApi.create,
    onSuccess: (p) => {
      toast.success(p.status === 'approved' ? 'Pass created and approved.' : 'Pass created. Waiting for approval.')
      onCreated(p)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const onSubmit = (data: PassInput) => {
    if (scope === 'admin' && !data.host_company) {
      toast.error('Choose the company being visited.')
      return
    }
    create.mutate({
      ...data,
      host_company: scope === 'admin' ? data.host_company : undefined,
      host_employee: scope === 'employee' ? undefined : data.host_employee || null,
      valid_from: localInputToIso(data.valid_from),
      valid_until: localInputToIso(data.valid_until),
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New visitor pass</DialogTitle>
          <DialogDescription>
            {scope === 'employee'
              ? 'Your company admin approves the pass, then the visitor receives a QR code link.'
              : 'The pass is approved immediately and the visitor receives a QR code link.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Visitor name" required error={errors.visitor_name?.message}>
              <Input {...register('visitor_name')} />
            </FormField>
            <FormField label="Visitor phone" required error={errors.visitor_phone?.message}>
              <Input type="tel" placeholder="+91…" {...register('visitor_phone')} />
            </FormField>
            <FormField label="Visitor email" error={errors.visitor_email?.message}>
              <Input type="email" {...register('visitor_email')} />
            </FormField>
            <FormField label="Visitor's organisation">
              <Input {...register('visitor_company')} />
            </FormField>
          </div>
          {scope === 'admin' && (
            <FormField label="Company being visited" required>
              <NativeSelect {...register('host_company')}>
                <option value="">Select company…</option>
                {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </FormField>
          )}
          {scope !== 'employee' && (
            <FormField label="Host employee" hint="The host is notified by SMS when the visitor arrives.">
              <NativeSelect {...register('host_employee')} disabled={!selectedCompany}>
                <option value="">No specific host</option>
                {employees?.map((e) => <option key={e.id} value={e.id}>{e.name}{e.department ? ` (${e.department})` : ''}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Purpose of visit">
              <Input {...register('purpose')} />
            </FormField>
            <FormField label="Vehicle number" error={errors.vehicle_number?.message}>
              <Input {...register('vehicle_number')} />
            </FormField>
            <FormField label="Valid from" required error={errors.valid_from?.message}>
              <Input type="datetime-local" {...register('valid_from')} />
            </FormField>
            <FormField label="Valid until" required error={errors.valid_until?.message}>
              <Input type="datetime-local" {...register('valid_until')} />
            </FormField>
          </div>
          <FormField label="Pass type" hint="A recurring pass can be used for several visits until it runs out.">
            <NativeSelect {...register('pass_type')}>
              <option value="pre_approved">Single visit</option>
              <option value="recurring">Recurring</option>
            </NativeSelect>
          </FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create pass'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PassDetailDialog({ pass, onClose, onCancel }: {
  pass: VisitorPass | null
  onClose: () => void
  onCancel: (pass: VisitorPass) => void
}) {
  if (!pass) return null
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pass.pass_url)
      toast.success('Pass link copied.')
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }
  const rows: [string, string][] = [
    ['Phone', pass.visitor_phone],
    ['Email', pass.visitor_email || '-'],
    ['From', pass.visitor_company || '-'],
    ['Visiting', pass.host_company_name],
    ['Host', pass.host_employee_name || '-'],
    ['Purpose', pass.purpose || '-'],
    ['Vehicle', pass.vehicle_number || '-'],
    ['Type', titleCase(pass.pass_type)],
    ['Valid from', formatDateTime(pass.valid_from)],
    ['Valid until', formatDateTime(pass.valid_until)],
    ['Created by', pass.created_by_name || '-'],
    ...(pass.approved_by_name ? [['Approved by', pass.approved_by_name] as [string, string]] : []),
    ...(pass.rejected_reason ? [['Rejection reason', pass.rejected_reason] as [string, string]] : []),
  ]
  const shareable = pass.status === 'approved' || pass.status === 'checked_in'
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">{pass.visitor_name} <StatusBadge status={pass.status} /></DialogTitle>
          <DialogDescription>Visitor pass details</DialogDescription>
        </DialogHeader>
        {shareable && pass.qr_code_image && (
          <div className="flex justify-center">
            <img src={pass.qr_code_image} alt="Pass QR code" className="h-44 w-44" />
          </div>
        )}
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-right break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {shareable && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Share this link with the visitor. They show the QR code at the gate.</p>
            <div className="flex gap-2">
              <Input readOnly value={pass.pass_url} onFocus={(e) => e.target.select()} aria-label="Pass link" />
              <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /> Copy</Button>
            </div>
          </div>
        )}
        {(pass.status === 'pending' || pass.status === 'approved') && (
          <Button variant="outline" className="text-destructive" onClick={() => onCancel(pass)}>
            <Ban className="h-4 w-4" /> Cancel this pass
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

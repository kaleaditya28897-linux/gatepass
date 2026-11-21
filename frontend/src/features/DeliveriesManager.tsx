import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ColumnDef } from '@tanstack/react-table'
import { Ban, Plus, RefreshCw } from 'lucide-react'
import { deliveriesApi } from '@/api/deliveries'
import { employeesApi } from '@/api/companies'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { deliverySchema, DeliveryInput } from '@/utils/validators'
import { DELIVERY_PLATFORMS, DELIVERY_STATUSES, DELIVERY_TYPES } from '@/utils/constants'
import { formatDateTime, localInputToIso, titleCase } from '@/utils/formatters'
import type { Delivery } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Scope = 'admin' | 'company' | 'employee'

const COPY: Record<Scope, { title: string; description: string }> = {
  admin: { title: 'Deliveries', description: 'All deliveries expected in the building' },
  company: { title: 'Deliveries', description: 'Deliveries for people in your company' },
  employee: { title: 'My Deliveries', description: 'Tell the gate what to expect, then share the OTP to collect it' },
}

export function DeliveriesManager({ scope }: { scope: Scope }) {
  const [status, setStatus] = useState('all')
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<Delivery | null>(null)
  const queryClient = useQueryClient()
  const canCreate = scope !== 'admin'
  const showOtp = scope !== 'admin'

  const list = useList<Delivery>('deliveries', deliveriesApi.list, {
    filters: { status },
    refetchInterval: scope === 'employee' ? 30000 : undefined,
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['deliveries'] })
    queryClient.invalidateQueries({ queryKey: ['company-stats'] })
  }
  const onError = (e: unknown) => toast.error(getErrorMessage(e))

  const cancel = useMutation({
    mutationFn: deliveriesApi.cancel,
    onSuccess: () => { refresh(); setCancelling(null); toast.success('Delivery cancelled.') },
    onError,
  })
  const regenerate = useMutation({
    mutationFn: deliveriesApi.regenerateOtp,
    onSuccess: () => { refresh(); toast.success('New OTP generated.') },
    onError,
  })

  const open = (d: Delivery) => d.status === 'expected' || d.status === 'arrived'

  const columns: ColumnDef<Delivery>[] = [
    ...(scope === 'admin' ? [{ accessorKey: 'company_name', header: 'Company' } as ColumnDef<Delivery>] : []),
    ...(scope !== 'employee' ? [{ accessorKey: 'employee_name', header: 'For' } as ColumnDef<Delivery>] : []),
    {
      accessorKey: 'delivery_type', header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{titleCase(row.original.delivery_type)}</Badge>,
    },
    {
      accessorKey: 'platform_name', header: 'From',
      cell: ({ row }) => (
        <div>
          <div>{row.original.platform_name || '-'}</div>
          {row.original.order_id && <div className="text-xs text-muted-foreground">#{row.original.order_id}</div>}
        </div>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} type="delivery" /> },
    ...(showOtp ? [{
      accessorKey: 'otp_code', header: 'OTP',
      cell: ({ row }) => open(row.original)
        ? <span className="font-mono text-base font-bold tracking-widest">{row.original.otp_code}</span>
        : <span className="text-muted-foreground">-</span>,
    } as ColumnDef<Delivery>] : []),
    { accessorKey: 'expected_at', header: 'Expected', cell: ({ row }) => formatDateTime(row.original.expected_at) },
    ...(canCreate ? [{
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const d = row.original
        if (!open(d)) return null
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Generate a new OTP" aria-label="Generate a new OTP"
              disabled={regenerate.isPending} onClick={() => regenerate.mutate(d.id)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {d.status === 'expected' && (
              <Button variant="ghost" size="icon" title="Cancel delivery" aria-label="Cancel delivery" onClick={() => setCancelling(d)}>
                <Ban className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        )
      },
    } as ColumnDef<Delivery>] : []),
  ]

  return (
    <div>
      <PageHeader
        title={COPY[scope].title}
        description={COPY[scope].description}
        action={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Delivery</Button>}
      />
      <Toolbar>
        <SearchInput value={list.search} onChange={list.setSearch} placeholder="Search platform or order ID" />
        <NativeSelect aria-label="Filter by status" className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {DELIVERY_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </NativeSelect>
      </Toolbar>
      {showOtp && (
        <p className="mb-3 text-sm text-muted-foreground">
          Give the OTP to the guard (or tell it to them over the phone) only when you are ready to collect the delivery.
        </p>
      )}
      <DataTable columns={columns} {...tableProps(list)} emptyMessage="No deliveries yet." />
      {creating && <CreateDialog scope={scope} onClose={() => setCreating(false)} onDone={() => { refresh(); setCreating(false) }} />}
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this delivery?"
        description="The gate will no longer expect it."
        confirmLabel="Cancel delivery"
        destructive
        pending={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </div>
  )
}

function CreateDialog({ scope, onClose, onDone }: { scope: Scope; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<DeliveryInput>({
    resolver: zodResolver(deliverySchema),
    defaultValues: { delivery_type: 'food_order' },
  })
  const { data: employees } = useQuery({
    queryKey: ['employee-directory', 'own'], queryFn: () => employeesApi.directory(), enabled: scope === 'company',
  })
  const create = useMutation({
    mutationFn: deliveriesApi.create,
    onSuccess: () => { toast.success('Delivery added. The gate has been told to expect it.'); onDone() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const onSubmit = (data: DeliveryInput) => {
    if (scope === 'company' && !data.employee) {
      setError('employee', { message: 'Choose who it is for' })
      return
    }
    create.mutate({
      ...data,
      employee: scope === 'company' ? data.employee : undefined,
      expected_at: data.expected_at ? localInputToIso(data.expected_at) : null,
    })
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add expected delivery</DialogTitle>
          <DialogDescription>You get a one-time code. The guard needs it to hand the delivery over.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {scope === 'company' && (
            <FormField label="For employee" required error={errors.employee?.message}>
              <NativeSelect {...register('employee')}>
                <option value="">Select employee…</option>
                {employees?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Type">
            <NativeSelect {...register('delivery_type')}>
              {DELIVERY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </NativeSelect>
          </FormField>
          <FormField label="Platform / courier">
            <Input list="delivery-platforms" placeholder="e.g. Swiggy, Amazon" {...register('platform_name')} />
          </FormField>
          <datalist id="delivery-platforms">
            {DELIVERY_PLATFORMS.map((p) => <option key={p} value={p} />)}
          </datalist>
          <FormField label="Order ID"><Input {...register('order_id')} /></FormField>
          <FormField label="Expected at"><Input type="datetime-local" {...register('expected_at')} /></FormField>
          <FormField label="Notes for the gate"><Input {...register('notes')} /></FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add delivery'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

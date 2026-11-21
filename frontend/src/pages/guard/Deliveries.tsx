import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { KeyRound, PackageCheck } from 'lucide-react'
import { deliveriesApi } from '@/api/deliveries'
import { useGuardGate } from '@/hooks/useGuardGate'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { tableProps, useList } from '@/hooks/useList'
import { formatTime, titleCase } from '@/utils/formatters'
import type { Delivery } from '@/types'
import { GateSelector } from '@/components/guard/GateSelector'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SearchInput, Toolbar } from '@/components/common/SearchInput'
import { FormField } from '@/components/common/FormField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function GuardDeliveriesPage() {
  const guardGate = useGuardGate()
  const queryClient = useQueryClient()
  const [arriving, setArriving] = useState<Delivery | null>(null)
  const [person, setPerson] = useState({ name: '', phone: '' })
  const [verifying, setVerifying] = useState<Delivery | null>(null)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)

  const list = useList<Delivery>('pending-deliveries', deliveriesApi.pendingGate, { refetchInterval: 30000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] })

  const arrived = useMutation({
    mutationFn: (d: Delivery) => deliveriesApi.arrived(d.id, {
      gate: guardGate.gate?.id,
      delivery_person_name: person.name.trim() || undefined,
      delivery_person_phone: person.phone.trim() || undefined,
    }),
    onSuccess: (d) => {
      refresh()
      setArriving(null)
      setPerson({ name: '', phone: '' })
      toast.success(`${d.employee_name} has been sent the collection OTP.`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const closeVerify = () => { setVerifying(null); setOtp(''); setOtpError(null) }
  const verify = useMutation({
    mutationFn: ({ id, code }: { id: number; code: string }) => deliveriesApi.verifyOtp(id, code),
    onSuccess: () => { refresh(); closeVerify(); toast.success('OTP correct. Hand over the delivery.') },
    onError: (e) => { refresh(); setOtp(''); setOtpError(getErrorMessage(e, 'Invalid OTP.')) },
  })

  const columns: ColumnDef<Delivery>[] = [
    {
      accessorKey: 'employee_name', header: 'For',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.employee_name}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.company_name}{row.original.company_floor ? `, ${row.original.company_floor}` : ''}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'platform_name', header: 'Delivery',
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-2">
            {row.original.platform_name || 'Delivery'} <Badge variant="outline">{titleCase(row.original.delivery_type)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {[row.original.order_id && `#${row.original.order_id}`, row.original.expected_at && `expected ${formatTime(row.original.expected_at)}`, row.original.notes].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} type="delivery" /> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const d = row.original
        return (
          <div className="flex justify-end">
            {d.status === 'expected' && (
              <Button variant="outline" size="sm" onClick={() => setArriving(d)}><PackageCheck className="h-4 w-4" /> Arrived</Button>
            )}
            {d.status === 'arrived' && (d.otp_locked
              ? <span className="text-xs text-destructive">Locked. Recipient must generate a new OTP.</span>
              : <Button size="sm" onClick={() => setVerifying(d)}><KeyRound className="h-4 w-4" /> Enter OTP</Button>)}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Deliveries" description="Mark deliveries as arrived, then release them with the recipient's OTP" />
      <GateSelector guardGate={guardGate} />
      <div>
        <Toolbar><SearchInput value={list.search} onChange={list.setSearch} placeholder="Search platform, order ID or rider" /></Toolbar>
        <DataTable columns={columns} {...tableProps(list)} emptyMessage="No deliveries are expected right now." />
      </div>

      <Dialog open={!!arriving} onOpenChange={(o) => { if (!o) setArriving(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delivery arrived</DialogTitle>
            <DialogDescription>
              {arriving ? `${arriving.platform_name || 'Delivery'} for ${arriving.employee_name}. They will get an SMS with the collection OTP.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Delivery person's name (optional)">
              <Input value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
            </FormField>
            <FormField label="Delivery person's phone (optional)">
              <Input type="tel" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} />
            </FormField>
            <Button className="w-full" disabled={arrived.isPending} onClick={() => arriving && arrived.mutate(arriving)}>
              {arrived.isPending ? 'Saving…' : 'Mark as arrived'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verifying} onOpenChange={(o) => { if (!o) closeVerify() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter collection OTP</DialogTitle>
            <DialogDescription>
              {verifying ? `Ask ${verifying.employee_name} for the 6-digit code. Only hand over the delivery when it is accepted.` : ''}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); if (verifying && otp.length === 6) { setOtpError(null); verify.mutate({ id: verifying.id, code: otp }) } }}
          >
            <Input
              aria-label="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            />
            {otpError && <p className="text-sm text-destructive" role="alert">{otpError}</p>}
            <Button type="submit" className="h-12 w-full text-base" disabled={otp.length !== 6 || verify.isPending}>
              {verify.isPending ? 'Checking…' : 'Verify and release'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveriesApi } from '@/api/deliveries'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Check, Package } from 'lucide-react'
import type { Delivery } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function GuardDeliveriesPage() {
  const [verifyId, setVerifyId] = useState<number | null>(null)
  const [otp, setOtp] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-deliveries'],
    queryFn: deliveriesApi.pendingGate,
    refetchInterval: 30000,
  })

  const arrivedMutation = useMutation({
    mutationFn: deliveriesApi.arrived,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] }),
  })

  const verifyMutation = useMutation({
    mutationFn: ({ id, otp }: { id: number; otp: string }) => deliveriesApi.verifyOtp(id, otp),
    onSuccess: (data, vars) => {
      if (data.verified) {
        deliveredMutation.mutate(vars.id)
      }
    },
  })

  const deliveredMutation = useMutation({
    mutationFn: deliveriesApi.delivered,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-deliveries'] })
      setVerifyId(null)
      setOtp('')
    },
  })

  const handleVerify = () => {
    if (verifyId && otp) {
      verifyMutation.mutate({ id: verifyId, otp })
    }
  }

  const columns: ColumnDef<Delivery>[] = [
    { accessorKey: 'company_name', header: 'Company' },
    { accessorKey: 'employee_name', header: 'Employee' },
    { accessorKey: 'delivery_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.delivery_type.replace('_', ' ')}</Badge> },
    { accessorKey: 'platform_name', header: 'Platform' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} type="delivery" /> },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.status === 'expected' && (
            <Button variant="outline" size="sm" onClick={() => arrivedMutation.mutate(row.original.id)}>
              <Package className="h-4 w-4 mr-1" /> Arrived
            </Button>
          )}
          {row.original.status === 'arrived' && (
            <Button variant="default" size="sm" onClick={() => setVerifyId(row.original.id)}>
              <Check className="h-4 w-4 mr-1" /> Verify OTP
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Pending Deliveries" description="Deliveries awaiting verification" />
      <DataTable columns={columns} data={data?.results || []} />
      <Dialog open={!!verifyId} onOpenChange={(o) => { if (!o) { setVerifyId(null); setOtp(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify Delivery OTP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" maxLength={6} />
            {verifyMutation.isError && <p className="text-destructive text-sm">Invalid OTP. Please try again.</p>}
            <Button onClick={handleVerify} disabled={otp.length !== 6 || verifyMutation.isPending} className="w-full">
              Verify & Mark Delivered
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

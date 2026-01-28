import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { deliveriesApi } from '@/api/deliveries'
import { deliverySchema, DeliveryInput } from '@/utils/validators'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { DELIVERY_TYPES, FOOD_PLATFORMS } from '@/utils/constants'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { Delivery } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function EmployeeDeliveriesPage() {
  const [open, setOpen] = useState(false)
  const { page, setPage } = usePagination()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', page],
    queryFn: () => deliveriesApi.list({ page: page.toString() }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DeliveryInput>({
    resolver: zodResolver(deliverySchema),
    defaultValues: { delivery_type: 'food_order' },
  })

  const createMutation = useMutation({
    mutationFn: deliveriesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deliveries'] }); setOpen(false); reset(); },
  })

  const onSubmit = (formData: DeliveryInput) => {
    createMutation.mutate(formData)
  }

  const columns: ColumnDef<Delivery>[] = [
    { accessorKey: 'delivery_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.delivery_type.replace('_', ' ')}</Badge> },
    { accessorKey: 'platform_name', header: 'Platform' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} type="delivery" /> },
    { accessorKey: 'otp_code', header: 'OTP', cell: ({ row }) => <span className="font-mono font-bold">{row.original.otp_code}</span> },
    { accessorKey: 'expected_at', header: 'Expected', cell: ({ row }) => row.original.expected_at ? formatDateTime(row.original.expected_at) : '-' },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader
        title="My Deliveries"
        description="Manage expected deliveries"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Delivery</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Expected Delivery</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="food_order" onValueChange={(v) => setValue('delivery_type', v as DeliveryInput['delivery_type'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select onValueChange={(v) => setValue('platform_name', v)}>
                    <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                    <SelectContent>
                      {FOOD_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order ID</Label>
                  <Input {...register('order_id')} />
                </div>
                <div className="space-y-2">
                  <Label>Expected At</Label>
                  <Input type="datetime-local" {...register('expected_at')} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input {...register('notes')} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Delivery</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

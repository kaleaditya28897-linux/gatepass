import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { passesApi } from '@/api/passes'
import { useAuthStore } from '@/store/authStore'
import { passSchema, PassInput } from '@/utils/validators'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { formatDateTime } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import type { VisitorPass } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function EmployeePassesPage() {
  const [open, setOpen] = useState(false)
  const { page, setPage } = usePagination()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['passes', page],
    queryFn: () => passesApi.list({ page: page.toString() }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PassInput>({
    resolver: zodResolver(passSchema),
    defaultValues: { host_company: user?.company?.id },
  })

  const createMutation = useMutation({
    mutationFn: passesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['passes'] }); setOpen(false); reset(); },
  })

  const onSubmit = (formData: PassInput) => {
    createMutation.mutate(formData)
  }

  const columns: ColumnDef<VisitorPass>[] = [
    { accessorKey: 'visitor_name', header: 'Visitor' },
    { accessorKey: 'visitor_phone', header: 'Phone' },
    { accessorKey: 'purpose', header: 'Purpose' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'valid_from', header: 'Valid From', cell: ({ row }) => formatDateTime(row.original.valid_from) },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader
        title="My Visitor Passes"
        description="Create and manage visitor passes"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Pass</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Visitor Pass</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <input type="hidden" {...register('host_company', { valueAsNumber: true })} value={user?.company?.id} />
                <div className="space-y-2">
                  <Label>Visitor Name</Label>
                  <Input {...register('visitor_name')} />
                  {errors.visitor_name && <p className="text-sm text-destructive">{errors.visitor_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Visitor Phone</Label>
                  <Input {...register('visitor_phone')} />
                  {errors.visitor_phone && <p className="text-sm text-destructive">{errors.visitor_phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Visitor Email</Label>
                  <Input {...register('visitor_email')} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Visitor Company</Label>
                  <Input {...register('visitor_company')} />
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input {...register('purpose')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valid From</Label>
                    <Input type="datetime-local" {...register('valid_from')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input type="datetime-local" {...register('valid_until')} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Pass</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

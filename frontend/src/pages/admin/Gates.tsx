import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { gatesApi } from '@/api/gates'
import { gateSchema, GateInput } from '@/utils/validators'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { GATE_TYPES } from '@/utils/constants'
import type { Gate } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { usePagination } from '@/hooks/usePagination'

export function GatesPage() {
  const [open, setOpen] = useState(false)
  const [editingGate, setEditingGate] = useState<Gate | null>(null)
  const { page, setPage } = usePagination()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['gates', page],
    queryFn: () => gatesApi.list({ page: page.toString() }),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<GateInput>({
    resolver: zodResolver(gateSchema),
    defaultValues: { gate_type: 'pedestrian' },
  })

  const createMutation = useMutation({
    mutationFn: gatesApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gates'] }); setOpen(false); reset(); },
  })

  const deleteMutation = useMutation({
    mutationFn: gatesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gates'] }),
  })

  const onSubmit = (formData: GateInput) => {
    createMutation.mutate(formData)
  }

  const columns: ColumnDef<Gate>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'location', header: 'Location' },
    { accessorKey: 'gate_type', header: 'Type', cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.gate_type}</Badge> },
    { accessorKey: 'is_active', header: 'Status', cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader
        title="Gates"
        description="Manage entry/exit gates"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Gate</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Gate</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...register('name')} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input {...register('code')} />
                  {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input {...register('location')} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select defaultValue="pedestrian" onValueChange={(v) => setValue('gate_type', v as 'pedestrian' | 'vehicle' | 'service')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

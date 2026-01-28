import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { companiesApi } from '@/api/companies'
import { companySchema, CompanyInput } from '@/utils/validators'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Company } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { usePagination } from '@/hooks/usePagination'

export function CompaniesPage() {
  const [open, setOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const { page, setPage } = usePagination()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page],
    queryFn: () => companiesApi.list({ page: page.toString() }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
  })

  const createMutation = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setOpen(false)
      reset()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Company> }) => companiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      setOpen(false)
      setEditingCompany(null)
      reset()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: companiesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  })

  const onSubmit = (formData: CompanyInput) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const columns: ColumnDef<Company>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'slug', header: 'Slug' },
    { accessorKey: 'floor', header: 'Floor' },
    { accessorKey: 'suite_number', header: 'Suite' },
    { accessorKey: 'employee_count', header: 'Employees' },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.is_active ? 'default' : 'secondary'}>{row.original.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditingCompany(row.original); setOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(row.original.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage tenant companies"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingCompany(null); reset(); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Company</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...register('name')} defaultValue={editingCompany?.name} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input {...register('slug')} defaultValue={editingCompany?.slug} />
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Floor</Label>
                    <Input {...register('floor')} defaultValue={editingCompany?.floor} />
                  </div>
                  <div className="space-y-2">
                    <Label>Suite</Label>
                    <Input {...register('suite_number')} defaultValue={editingCompany?.suite_number} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...register('email')} type="email" defaultValue={editingCompany?.email} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input {...register('phone')} defaultValue={editingCompany?.phone} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCompany ? 'Update' : 'Create'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <DataTable
        columns={columns}
        data={data?.results || []}
        pageCount={data ? Math.ceil(data.count / 20) : 0}
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}

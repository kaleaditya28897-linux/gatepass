import { useQuery } from '@tanstack/react-query'
import { employeesApi } from '@/api/companies'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { usePagination } from '@/hooks/usePagination'
import type { Employee } from '@/types'
import { ColumnDef } from '@tanstack/react-table'

export function AdminEmployeesPage() {
  const { page, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => employeesApi.list({ page: page.toString() }),
  })

  const columns: ColumnDef<Employee>[] = [
    { accessorKey: 'first_name', header: 'First Name' },
    { accessorKey: 'last_name', header: 'Last Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'company_name', header: 'Company' },
    { accessorKey: 'designation', header: 'Designation' },
    { accessorKey: 'department', header: 'Department' },
  ]

  if (isLoading) return <LoadingSpinner className="h-64" />

  return (
    <div>
      <PageHeader title="Employees" description="All employees across companies" />
      <DataTable columns={columns} data={data?.results || []} pageCount={data ? Math.ceil(data.count / 20) : 0} page={page} onPageChange={setPage} />
    </div>
  )
}

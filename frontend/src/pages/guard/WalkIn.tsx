import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { passesApi } from '@/api/passes'
import { companiesApi, employeesApi } from '@/api/companies'
import { useGuardGate } from '@/hooks/useGuardGate'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { walkInSchema, WalkInInput } from '@/utils/validators'
import { ID_TYPES } from '@/utils/constants'
import { GateSelector } from '@/components/guard/GateSelector'
import { PageHeader } from '@/components/common/PageHeader'
import { FormField } from '@/components/common/FormField'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { CheckCircle2 } from 'lucide-react'

export function WalkInPage() {
  const guardGate = useGuardGate()
  const queryClient = useQueryClient()
  const [done, setDone] = useState<string | null>(null)
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<WalkInInput>({
    resolver: zodResolver(walkInSchema),
  })

  const { data: companies } = useQuery({ queryKey: ['company-directory'], queryFn: companiesApi.directory })
  const companyId = Number(watch('host_company')) || undefined
  const { data: employees } = useQuery({
    queryKey: ['employee-directory', companyId],
    queryFn: () => employeesApi.directory(companyId),
    enabled: !!companyId,
  })
  useEffect(() => { setValue('host_employee', undefined) }, [companyId, setValue])

  const register_ = useMutation({
    mutationFn: passesApi.walkIn,
    onSuccess: (pass) => {
      queryClient.invalidateQueries({ queryKey: ['active-entries'] })
      const message = `${pass.visitor_name} checked in to visit ${pass.host_company_name}.`
      setDone(message)
      toast.success(message)
      reset()
      window.scrollTo({ top: 0 })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const onSubmit = (data: WalkInInput) => {
    if (!guardGate.gate) {
      toast.error('Choose your gate first.')
      return
    }
    setDone(null)
    register_.mutate({ ...data, host_employee: data.host_employee || null, gate: guardGate.gate.id })
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="Walk-in Visitor" description="Register a visitor who arrived without a pass and check them in" />
      <GateSelector guardGate={guardGate} />
      {done && (
        <Card className="border-green-600">
          <CardContent className="flex items-center gap-3 p-4" role="status">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
            <p className="font-medium">{done}</p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Visitor name" required error={errors.visitor_name?.message}><Input {...register('visitor_name')} /></FormField>
              <FormField label="Visitor phone" required error={errors.visitor_phone?.message}><Input type="tel" inputMode="tel" {...register('visitor_phone')} /></FormField>
              <FormField label="Visiting company" required error={errors.host_company?.message}>
                <NativeSelect {...register('host_company')}>
                  <option value="">Select company…</option>
                  {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.floor ? ` (${c.floor})` : ''}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="Person they are meeting" hint="They get an SMS that their visitor has arrived.">
                <NativeSelect {...register('host_employee')} disabled={!companyId}>
                  <option value="">Not sure / reception</option>
                  {employees?.map((e) => <option key={e.id} value={e.id}>{e.name}{e.department ? ` (${e.department})` : ''}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="Visitor's organisation"><Input {...register('visitor_company')} /></FormField>
              <FormField label="Purpose"><Input {...register('purpose')} /></FormField>
              <FormField label="ID shown">
                <NativeSelect {...register('id_type')}>
                  <option value="">None</option>
                  {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="ID number (last 4 digits is enough)"><Input {...register('id_number')} /></FormField>
              <FormField label="Vehicle number" error={errors.vehicle_number?.message}><Input {...register('vehicle_number')} /></FormField>
            </div>
            <Button type="submit" className="h-12 w-full text-base" disabled={register_.isPending || !guardGate.gate}>
              {register_.isPending ? 'Checking in…' : 'Register and check in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { entriesApi } from '@/api/entries'
import { useGuardGate } from '@/hooks/useGuardGate'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { extractPassCode, formatDateTime } from '@/utils/formatters'
import type { VerifiedVisitorPass } from '@/types'
import { GateSelector } from '@/components/guard/GateSelector'
import { QrScanner } from '@/components/guard/QrScanner'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, LogIn, LogOut, XCircle } from 'lucide-react'

const BLOCKED_REASON: Partial<Record<VerifiedVisitorPass['status'], string>> = {
  pending: 'This pass has not been approved yet. Ask the visitor to contact their host.',
  rejected: 'This pass was rejected by the host company.',
  cancelled: 'This pass was cancelled.',
  expired: 'This pass has expired.',
  checked_out: 'This pass has already been used and the visitor has left.',
}

export function ScanPage() {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const guardGate = useGuardGate()

  const lookup = useMutation({
    mutationFn: (code: string) => passesApi.verify(code),
    onMutate: () => setDone(null),
  })
  const pass = lookup.data

  const afterGateAction = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['active-entries'] })
    setDone(message)
    setTyped('')
    lookup.reset()
    toast.success(message)
  }

  const checkIn = useMutation({
    mutationFn: entriesApi.checkIn,
    onSuccess: (entry) => afterGateAction(`${entry.visitor_name} checked in at ${entry.gate_name}.`),
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const checkOut = useMutation({
    mutationFn: entriesApi.checkOut,
    onSuccess: (entry) => afterGateAction(`${entry.visitor_name} checked out.`),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const find = (raw: string) => {
    const code = extractPassCode(raw)
    if (!code) {
      toast.error('That is not a GatePass code. Scan the QR on the visitor’s pass.')
      return
    }
    lookup.mutate(code)
  }

  const details: [string, string | undefined][] = pass ? [
    ['Phone', pass.visitor_phone],
    ['From', pass.visitor_company],
    ['Visiting', pass.host_company_name],
    ['Host', pass.host_employee_name ?? undefined],
    ['Purpose', pass.purpose],
    ['ID', [pass.id_type, pass.id_number].filter(Boolean).join(' ') || undefined],
    ['Vehicle', pass.vehicle_number],
    ['Valid from', formatDateTime(pass.valid_from)],
    ['Valid until', formatDateTime(pass.valid_until)],
  ] : []

  return (
    <div className="space-y-4">
      <PageHeader title="Scan Pass" description="Scan the visitor's QR code to check them in or out" />
      <GateSelector guardGate={guardGate} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Find the pass</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <QrScanner onScan={find} />
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); find(typed) }}>
              <Label htmlFor="pass-code">Or type / paste the pass code or link</Label>
              <div className="flex gap-2">
                <Input id="pass-code" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" />
                <Button type="submit" variant="outline" disabled={!typed.trim() || lookup.isPending}>Find</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {done && (
          <Card className="border-green-600">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center" role="status">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <p className="text-lg font-semibold">{done}</p>
              <p className="text-sm text-muted-foreground">Ready for the next visitor.</p>
            </CardContent>
          </Card>
        )}

        {lookup.isError && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center" role="alert">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-lg font-semibold">Pass not found</p>
              <p className="text-sm text-muted-foreground">{getErrorMessage(lookup.error, 'Do not let the visitor in on this code.')}</p>
            </CardContent>
          </Card>
        )}

        {pass && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{pass.visitor_name}</span>
                <StatusBadge status={pass.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pass.photo && <img src={pass.photo} alt={`Photo of ${pass.visitor_name}`} className="mx-auto h-32 w-32 rounded-md object-cover" />}
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                {details.filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {pass.status === 'approved' && pass.pass_code && (
                <Button
                  className="h-12 w-full text-base"
                  disabled={!guardGate.gate || checkIn.isPending}
                  onClick={() => guardGate.gate && checkIn.mutate({ pass_code: pass.pass_code!, gate: guardGate.gate.id })}
                >
                  <LogIn className="h-5 w-5" /> {checkIn.isPending ? 'Checking in…' : 'Check in'}
                </Button>
              )}
              {pass.status === 'approved' && !guardGate.gate && (
                <p className="text-center text-sm text-destructive">Choose your gate above first.</p>
              )}
              {pass.status === 'checked_in' && pass.active_entry && (
                <Button className="h-12 w-full text-base" variant="outline" disabled={checkOut.isPending}
                  onClick={() => checkOut.mutate(pass.active_entry!)}>
                  <LogOut className="h-5 w-5" /> {checkOut.isPending ? 'Checking out…' : 'Visitor is leaving: check out'}
                </Button>
              )}
              {BLOCKED_REASON[pass.status] && (
                <p className="rounded-md bg-destructive/10 p-3 text-center text-sm font-medium text-destructive" role="alert">
                  Do not admit. {BLOCKED_REASON[pass.status]}
                  {pass.rejected_reason ? ` Reason: ${pass.rejected_reason}` : ''}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

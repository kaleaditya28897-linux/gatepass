import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { formatDateTime } from '@/utils/formatters'
import type { VerifiedVisitorPass } from '@/types'

const STATUS_NOTE: Record<VerifiedVisitorPass['status'], string> = {
  pending: 'This pass is waiting for approval. You will be able to use it once the host company approves it.',
  approved: 'Show this QR code to the guard at the gate.',
  checked_in: 'You are checked in. Show this QR code again when you leave.',
  checked_out: 'This visit is complete. Thank you for visiting.',
  expired: 'This pass has expired. Ask your host for a new one.',
  rejected: 'This pass was not approved. Please contact your host.',
  cancelled: 'This pass was cancelled. Please contact your host.',
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">{children}</div>
}

export function PublicPassPage() {
  const { code } = useParams<{ code: string }>()

  const { data: pass, isLoading } = useQuery({
    queryKey: ['pass-verify', code],
    queryFn: () => passesApi.verify(code!),
    enabled: !!code,
    retry: false,
    refetchInterval: 120000,
  })

  if (isLoading) return <Shell><LoadingSpinner size="lg" /></Shell>

  // A failed background refresh keeps showing the pass we already have.
  if (!pass) {
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="font-semibold leading-none tracking-tight text-destructive">Pass not found</h1>
            <CardDescription>
              This visitor pass link is not valid. Check that you opened the full link you were sent, or ask your host to send it again.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    )
  }

  const usable = pass.status === 'approved' || pass.status === 'checked_in'
  return (
    <Shell>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardDescription>Visitor pass</CardDescription>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">{pass.visitor_name}</h1>
          <div className="flex justify-center pt-1"><StatusBadge status={pass.status} /></div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usable && pass.qr_code_image && (
            <div className="flex justify-center">
              <img src={pass.qr_code_image} alt="QR code for this pass" className="w-56 h-56" />
            </div>
          )}
          <p className={`text-center text-sm ${usable ? 'text-muted-foreground' : 'font-medium'}`}>{STATUS_NOTE[pass.status]}</p>
          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Visiting</dt>
              <dd className="font-medium text-right">{pass.host_company_name}</dd>
            </div>
            {pass.host_employee_name && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Host</dt>
                <dd className="font-medium text-right">{pass.host_employee_name}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Valid from</dt>
              <dd className="font-medium text-right">{formatDateTime(pass.valid_from)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Valid until</dt>
              <dd className="font-medium text-right">{formatDateTime(pass.valid_until)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </Shell>
  )
}

import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { formatDateTime } from '@/utils/formatters'

export function PublicPassPage() {
  const { code } = useParams<{ code: string }>()

  const { data: pass, isLoading, error } = useQuery({
    queryKey: ['pass-verify', code],
    queryFn: () => passesApi.verify(code!),
    enabled: !!code,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !pass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Pass Not Found</CardTitle>
            <CardDescription>This visitor pass does not exist or has been removed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Visitor Pass</CardTitle>
          <CardDescription>{pass.host_company_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <StatusBadge status={pass.status} />
          </div>
          {pass.qr_code_image && (
            <div className="flex justify-center">
              <img src={pass.qr_code_image} alt="QR Code" className="w-48 h-48" />
            </div>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visitor</span>
              <span className="font-medium">{pass.visitor_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{pass.visitor_phone}</span>
            </div>
            {pass.visitor_company && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium">{pass.visitor_company}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Host</span>
              <span className="font-medium">{pass.host_employee_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valid From</span>
              <span className="font-medium">{formatDateTime(pass.valid_from)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valid Until</span>
              <span className="font-medium">{formatDateTime(pass.valid_until)}</span>
            </div>
            {pass.purpose && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">Purpose</span>
                <p className="font-medium mt-1">{pass.purpose}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

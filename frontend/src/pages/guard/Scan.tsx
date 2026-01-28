import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { passesApi } from '@/api/passes'
import { entriesApi } from '@/api/entries'
import { gatesApi } from '@/api/gates'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/common/StatusBadge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { formatDateTime } from '@/utils/formatters'
import { QrCode, Check } from 'lucide-react'

export function ScanPage() {
  const [passCode, setPassCode] = useState('')
  const [selectedGate, setSelectedGate] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: gates } = useQuery({
    queryKey: ['gates'],
    queryFn: () => gatesApi.list(),
  })

  const verifyMutation = useMutation({
    mutationFn: passesApi.verify,
  })

  const checkInMutation = useMutation({
    mutationFn: entriesApi.checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-entries'] })
      setPassCode('')
      verifyMutation.reset()
    },
  })

  const handleVerify = () => {
    if (passCode) {
      verifyMutation.mutate(passCode)
    }
  }

  const handleCheckIn = () => {
    if (passCode && selectedGate) {
      checkInMutation.mutate({ pass_code: passCode, gate: parseInt(selectedGate) })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Scan QR Code" description="Verify and check in visitors" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Enter Pass Code</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pass Code (UUID)</Label>
              <Input value={passCode} onChange={(e) => setPassCode(e.target.value)} placeholder="Enter or scan pass code" />
            </div>
            <div className="space-y-2">
              <Label>Gate</Label>
              <Select value={selectedGate} onValueChange={setSelectedGate}>
                <SelectTrigger><SelectValue placeholder="Select gate" /></SelectTrigger>
                <SelectContent>
                  {gates?.results.map((g) => <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleVerify} disabled={!passCode || verifyMutation.isPending} className="w-full">
              Verify Pass
            </Button>
          </CardContent>
        </Card>
        {verifyMutation.data && (
          <Card>
            <CardHeader><CardTitle>Pass Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={verifyMutation.data.status} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Visitor</span><span className="font-medium">{verifyMutation.data.visitor_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{verifyMutation.data.visitor_phone}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="font-medium">{verifyMutation.data.host_company_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Host</span><span className="font-medium">{verifyMutation.data.host_employee_name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valid Until</span><span className="font-medium">{formatDateTime(verifyMutation.data.valid_until)}</span></div>
              </div>
              {verifyMutation.data.status === 'approved' && (
                <Button onClick={handleCheckIn} disabled={!selectedGate || checkInMutation.isPending} className="w-full">
                  <Check className="h-4 w-4 mr-2" /> Check In
                </Button>
              )}
              {checkInMutation.isSuccess && <p className="text-green-600 text-center font-medium">Checked in successfully!</p>}
            </CardContent>
          </Card>
        )}
        {verifyMutation.isError && (
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive text-center">Pass not found or invalid.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

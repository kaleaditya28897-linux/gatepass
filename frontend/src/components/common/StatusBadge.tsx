import { Badge } from '@/components/ui/badge'
import { PASS_STATUS_COLORS, DELIVERY_STATUS_COLORS } from '@/utils/constants'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  type?: 'pass' | 'delivery'
}

export function StatusBadge({ status, type = 'pass' }: StatusBadgeProps) {
  const colors = type === 'pass' ? PASS_STATUS_COLORS : DELIVERY_STATUS_COLORS
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800'
  return (
    <Badge variant="outline" className={cn('capitalize', colorClass)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return format(parseISO(dateString), 'MMM d, yyyy')
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return format(parseISO(dateString), 'MMM d, yyyy h:mm a')
}

export function formatRelative(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-'
  return phone
}

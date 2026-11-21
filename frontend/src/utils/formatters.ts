import { format, formatDistanceToNow, parseISO } from 'date-fns'

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return format(parseISO(dateString), 'MMM d, yyyy')
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return format(parseISO(dateString), 'MMM d, yyyy h:mm a')
}

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return format(parseISO(dateString), 'h:mm a')
}

export function formatRelative(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true })
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-'
  return phone
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Value for <input type="datetime-local"> in the browser's own timezone. */
export function toLocalInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/** datetime-local value -> ISO string with timezone, so the server never has to guess. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Pull the pass code out of whatever the scanner read (a pass URL or a bare code). */
export function extractPassCode(text: string): string | null {
  const match = text.match(UUID_PATTERN)
  return match ? match[0].toLowerCase() : null
}

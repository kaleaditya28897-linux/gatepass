import { AxiosError } from 'axios'

function flatten(value: unknown, prefix = ''): string[] {
  if (value == null) return []
  if (typeof value === 'string') return [prefix ? `${prefix}: ${value}` : value]
  if (Array.isArray(value)) return value.flatMap((v) => flatten(v, prefix))
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) => {
      const label = key === 'detail' || key === 'non_field_errors' ? prefix : key.replace(/_/g, ' ')
      return flatten(v, label)
    })
  }
  return [String(value)]
}

/** Turn any API failure into a sentence a person at a gate can act on. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.'
    const { status, data } = error.response
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
    if (status >= 500) return 'The server ran into a problem. Please try again shortly.'
    if (typeof data === 'string') return status === 404 ? 'Not found.' : fallback
    const messages = flatten(data)
    if (messages.length) return messages.slice(0, 4).join(' ')
  }
  return fallback
}

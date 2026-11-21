import { apiClient } from './client'
import type { EntryLog, PaginatedResponse } from '@/types'

export const entriesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<EntryLog>> => {
    const response = await apiClient.get('/entries/', { params })
    return response.data
  },

  active: async (params?: Record<string, string>): Promise<PaginatedResponse<EntryLog>> => {
    const response = await apiClient.get('/entries/active/', { params })
    return response.data
  },

  /** Download the filtered log as CSV (admin only). */
  exportCsv: async (params?: Record<string, string>): Promise<void> => {
    const response = await apiClient.get('/entries/export/', { params, responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `gatepass-entries-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },

  checkIn: async (data: { pass_code?: string; delivery_id?: number; gate: number }): Promise<EntryLog> => {
    const response = await apiClient.post('/entries/check-in/', data)
    return response.data
  },

  checkOut: async (id: number): Promise<EntryLog> => {
    const response = await apiClient.post(`/entries/${id}/check-out/`)
    return response.data
  },
}

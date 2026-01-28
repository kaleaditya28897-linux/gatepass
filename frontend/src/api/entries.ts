import { apiClient } from './client'
import type { EntryLog, PaginatedResponse } from '@/types'

export const entriesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<EntryLog>> => {
    const response = await apiClient.get('/entries/', { params })
    return response.data
  },

  active: async (): Promise<PaginatedResponse<EntryLog>> => {
    const response = await apiClient.get('/entries/active/')
    return response.data
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

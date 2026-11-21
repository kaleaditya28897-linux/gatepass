import { apiClient } from './client'
import type { Notification, PaginatedResponse } from '@/types'

export const notificationsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Notification>> => {
    const response = await apiClient.get('/notifications/', { params })
    return response.data
  },
}

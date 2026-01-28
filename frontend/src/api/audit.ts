import { apiClient } from './client'
import type { AuditLog, PaginatedResponse } from '@/types'

export const auditApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<AuditLog>> => {
    const response = await apiClient.get('/audit-logs/', { params })
    return response.data
  },
}

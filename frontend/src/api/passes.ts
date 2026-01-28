import { apiClient } from './client'
import type { VisitorPass, PaginatedResponse } from '@/types'

export const passesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<VisitorPass>> => {
    const response = await apiClient.get('/passes/', { params })
    return response.data
  },

  get: async (id: number): Promise<VisitorPass> => {
    const response = await apiClient.get(`/passes/${id}/`)
    return response.data
  },

  create: async (data: Partial<VisitorPass>): Promise<VisitorPass> => {
    const response = await apiClient.post('/passes/', data)
    return response.data
  },

  update: async (id: number, data: Partial<VisitorPass>): Promise<VisitorPass> => {
    const response = await apiClient.patch(`/passes/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/passes/${id}/`)
  },

  approve: async (id: number): Promise<VisitorPass> => {
    const response = await apiClient.post(`/passes/${id}/approve/`)
    return response.data
  },

  reject: async (id: number, reason: string): Promise<VisitorPass> => {
    const response = await apiClient.post(`/passes/${id}/reject/`, { reason })
    return response.data
  },

  verify: async (code: string): Promise<VisitorPass> => {
    const response = await apiClient.get(`/passes/verify/${code}/`)
    return response.data
  },

  walkIn: async (data: Partial<VisitorPass>): Promise<VisitorPass> => {
    const response = await apiClient.post('/passes/walk-in/', data)
    return response.data
  },
}

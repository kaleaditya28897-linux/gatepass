import { apiClient } from './client'
import type { Delivery, PaginatedResponse } from '@/types'

export const deliveriesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Delivery>> => {
    const response = await apiClient.get('/deliveries/', { params })
    return response.data
  },

  get: async (id: number): Promise<Delivery> => {
    const response = await apiClient.get(`/deliveries/${id}/`)
    return response.data
  },

  create: async (data: Partial<Delivery>): Promise<Delivery> => {
    const response = await apiClient.post('/deliveries/', data)
    return response.data
  },

  update: async (id: number, data: Partial<Delivery>): Promise<Delivery> => {
    const response = await apiClient.patch(`/deliveries/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/deliveries/${id}/`)
  },

  arrived: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post(`/deliveries/${id}/arrived/`)
    return response.data
  },

  delivered: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post(`/deliveries/${id}/delivered/`)
    return response.data
  },

  verifyOtp: async (id: number, otp: string): Promise<{ verified: boolean }> => {
    const response = await apiClient.post(`/deliveries/${id}/verify-otp/`, { otp })
    return response.data
  },

  pendingGate: async (): Promise<PaginatedResponse<Delivery>> => {
    const response = await apiClient.get('/deliveries/pending-gate/')
    return response.data
  },
}

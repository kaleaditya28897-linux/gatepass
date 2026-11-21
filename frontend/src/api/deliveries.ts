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

  create: async (data: Record<string, unknown>): Promise<Delivery> => {
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

  cancel: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post(`/deliveries/${id}/cancel/`)
    return response.data
  },

  regenerateOtp: async (id: number): Promise<Delivery> => {
    const response = await apiClient.post(`/deliveries/${id}/regenerate-otp/`)
    return response.data
  },

  arrived: async (
    id: number,
    data: { gate?: number; delivery_person_name?: string; delivery_person_phone?: string } = {},
  ): Promise<Delivery> => {
    const response = await apiClient.post(`/deliveries/${id}/arrived/`, data)
    return response.data
  },

  /** Checks the recipient's OTP; a correct code releases the delivery in the same step. */
  verifyOtp: async (id: number, otp: string): Promise<{ verified: boolean; detail: string }> => {
    const response = await apiClient.post(`/deliveries/${id}/verify-otp/`, { otp })
    return response.data
  },

  pendingGate: async (params?: Record<string, string>): Promise<PaginatedResponse<Delivery>> => {
    const response = await apiClient.get('/deliveries/pending-gate/', { params })
    return response.data
  },
}

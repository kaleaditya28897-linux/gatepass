import { apiClient } from './client'
import type { Gate, Guard, GuardShift, PaginatedResponse } from '@/types'

export const gatesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Gate>> => {
    const response = await apiClient.get('/gates/', { params })
    return response.data
  },

  get: async (id: number): Promise<Gate> => {
    const response = await apiClient.get(`/gates/${id}/`)
    return response.data
  },

  create: async (data: Partial<Gate>): Promise<Gate> => {
    const response = await apiClient.post('/gates/', data)
    return response.data
  },

  update: async (id: number, data: Partial<Gate>): Promise<Gate> => {
    const response = await apiClient.patch(`/gates/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/gates/${id}/`)
  },
}

export const guardsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Guard>> => {
    const response = await apiClient.get('/guards/', { params })
    return response.data
  },

  get: async (id: number): Promise<Guard> => {
    const response = await apiClient.get(`/guards/${id}/`)
    return response.data
  },

  create: async (data: Record<string, unknown>): Promise<Guard> => {
    const response = await apiClient.post('/guards/', data)
    return response.data
  },

  update: async (id: number, data: Partial<Guard>): Promise<Guard> => {
    const response = await apiClient.patch(`/guards/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/guards/${id}/`)
  },
}

export const shiftsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<GuardShift>> => {
    const response = await apiClient.get('/shifts/', { params })
    return response.data
  },

  myCurrent: async (): Promise<GuardShift> => {
    const response = await apiClient.get('/shifts/my-current/')
    return response.data
  },

  create: async (data: Partial<GuardShift>): Promise<GuardShift> => {
    const response = await apiClient.post('/shifts/', data)
    return response.data
  },

  update: async (id: number, data: Partial<GuardShift>): Promise<GuardShift> => {
    const response = await apiClient.patch(`/shifts/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/shifts/${id}/`)
  },
}

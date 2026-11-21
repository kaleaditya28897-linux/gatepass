import { apiClient } from './client'
import type { LoginResponse, ManagedUser, PaginatedResponse, User } from '@/types'

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login/', { username, password })
    return response.data
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me/')
    return response.data
  },

  updateProfile: async (data: Partial<Pick<User, 'first_name' | 'last_name' | 'email' | 'phone'>>): Promise<User> => {
    const response = await apiClient.patch('/auth/me/', data)
    return response.data
  },

  changePassword: async (current_password: string, new_password: string): Promise<void> => {
    await apiClient.post('/auth/change-password/', { current_password, new_password })
  },
}

export const usersApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<ManagedUser>> => {
    const response = await apiClient.get('/auth/users/', { params })
    return response.data
  },

  create: async (data: Record<string, unknown>): Promise<ManagedUser> => {
    const response = await apiClient.post('/auth/users/', data)
    return response.data
  },

  update: async (id: number, data: Record<string, unknown>): Promise<ManagedUser> => {
    const response = await apiClient.patch(`/auth/users/${id}/`, data)
    return response.data
  },

  setPassword: async (id: number, new_password: string): Promise<void> => {
    await apiClient.post(`/auth/users/${id}/set-password/`, { new_password })
  },
}

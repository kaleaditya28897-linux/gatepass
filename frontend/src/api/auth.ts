import { apiClient } from './client'
import type { LoginResponse, User } from '@/types'

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login/', { username, password })
    return response.data
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me/')
    return response.data
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post('/auth/token/refresh/', { refresh })
    return response.data
  },
}

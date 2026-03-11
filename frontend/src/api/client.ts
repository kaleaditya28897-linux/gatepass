import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

function clearSession() {
  useAuthStore.getState().logout()
  queryClient.clear()
}

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        clearSession()
        return Promise.reject(error)
      }

      try {
        const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        })
        useAuthStore.getState().setToken(response.data.access)
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`
        return apiClient.request(originalRequest)
      } catch {
        clearSession()
      }
    }
    return Promise.reject(error)
  }
)

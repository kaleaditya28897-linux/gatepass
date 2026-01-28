import { apiClient } from './client'
import type { Company, Employee, PaginatedResponse } from '@/types'

export const companiesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Company>> => {
    const response = await apiClient.get('/companies/', { params })
    return response.data
  },

  get: async (id: number): Promise<Company> => {
    const response = await apiClient.get(`/companies/${id}/`)
    return response.data
  },

  create: async (data: Partial<Company>): Promise<Company> => {
    const response = await apiClient.post('/companies/', data)
    return response.data
  },

  update: async (id: number, data: Partial<Company>): Promise<Company> => {
    const response = await apiClient.patch(`/companies/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/companies/${id}/`)
  },

  stats: async (id: number): Promise<Record<string, number>> => {
    const response = await apiClient.get(`/companies/${id}/stats/`)
    return response.data
  },
}

export const employeesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Employee>> => {
    const response = await apiClient.get('/companies/employees/', { params })
    return response.data
  },

  get: async (id: number): Promise<Employee> => {
    const response = await apiClient.get(`/companies/employees/${id}/`)
    return response.data
  },

  create: async (data: Record<string, unknown>): Promise<Employee> => {
    const response = await apiClient.post('/companies/employees/', data)
    return response.data
  },

  update: async (id: number, data: Partial<Employee>): Promise<Employee> => {
    const response = await apiClient.patch(`/companies/employees/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/companies/employees/${id}/`)
  },

  bulkUpload: async (file: File, companyId: number): Promise<{ created: number; errors: unknown[] }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('company', companyId.toString())
    const response = await apiClient.post('/companies/employees/bulk-upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}

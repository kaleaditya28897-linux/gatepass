import { AxiosError } from 'axios'
import { apiClient } from './client'
import type { Company, CompanyOption, Employee, EmployeeOption, PaginatedResponse } from '@/types'

export const companiesApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Company>> => {
    const response = await apiClient.get('/companies/', { params })
    return response.data
  },

  get: async (id: number): Promise<Company> => {
    const response = await apiClient.get(`/companies/${id}/`)
    return response.data
  },

  /** Active companies for pickers. */
  directory: async (): Promise<CompanyOption[]> => {
    const response = await apiClient.get('/companies/directory/')
    return response.data
  },

  create: async (data: Record<string, unknown>): Promise<Company> => {
    const response = await apiClient.post('/companies/', data)
    return response.data
  },

  update: async (id: number, data: Record<string, unknown>): Promise<Company> => {
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

  /** Active employees of one company for host pickers. */
  directory: async (companyId?: number): Promise<EmployeeOption[]> => {
    const response = await apiClient.get('/companies/employees/directory/', {
      params: companyId ? { company: companyId } : undefined,
    })
    return response.data
  },

  update: async (id: number, data: Record<string, unknown>): Promise<Employee> => {
    const response = await apiClient.patch(`/companies/employees/${id}/`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/companies/employees/${id}/`)
  },

  bulkUpload: async (file: File, companyId?: number): Promise<BulkUploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    if (companyId) formData.append('company', companyId.toString())
    // Some rows failing is reported in the body with a 400 when nothing was created.
    const response = await apiClient.post('/companies/employees/bulk-upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      validateStatus: (status) => status === 201 || status === 400,
    })
    if (response.status === 400 && typeof response.data?.created !== 'number') {
      throw new AxiosError('Upload rejected', undefined, response.config, response.request, response)
    }
    return response.data
  },
}

export interface BulkUploadResult {
  created: number
  errors: { row: number; username: string; error: string }[]
}

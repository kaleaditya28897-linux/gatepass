import { apiClient } from './client'
import type { AnalyticsOverview } from '@/types'

export const analyticsApi = {
  overview: async (): Promise<AnalyticsOverview> => {
    const response = await apiClient.get('/analytics/overview/')
    return response.data
  },

  entriesByDate: async (days = 30): Promise<{ date: string; count: number }[]> => {
    const response = await apiClient.get('/analytics/entries-by-date/', { params: { days } })
    return response.data
  },

  entriesByGate: async (days = 30): Promise<{ gate__name: string; count: number }[]> => {
    const response = await apiClient.get('/analytics/entries-by-gate/', { params: { days } })
    return response.data
  },

  peakHours: async (days = 30): Promise<{ hour: string; count: number }[]> => {
    const response = await apiClient.get('/analytics/peak-hours/', { params: { days } })
    return response.data
  },

  deliveryStats: async (days = 30): Promise<Record<string, unknown>> => {
    const response = await apiClient.get('/analytics/delivery-stats/', { params: { days } })
    return response.data
  },
}

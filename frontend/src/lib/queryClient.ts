import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Gate data changes by the minute; never show a list that is long out of date.
      staleTime: 1000 * 20,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const status = error instanceof AxiosError ? error.response?.status : undefined
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
    },
  },
})

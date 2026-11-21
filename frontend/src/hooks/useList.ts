import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PaginatedResponse } from '@/types'
import { getErrorMessage } from '@/lib/errors'

export const PAGE_SIZE = 20

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

type Params = Record<string, string>

/**
 * Server-side paginated list with search and filters. Changing the search or a
 * filter jumps back to page 1.
 */
export function useList<T>(
  key: string,
  fetcher: (params: Params) => Promise<PaginatedResponse<T>>,
  options: { filters?: Record<string, string | undefined>; refetchInterval?: number } = {},
) {
  const [page, setPage] = useState(1)
  const [search, setSearchValue] = useState('')
  const debouncedSearch = useDebounced(search)
  const filters = Object.fromEntries(
    Object.entries(options.filters ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
  ) as Params
  const filterKey = JSON.stringify(filters)

  useEffect(() => { setPage(1) }, [debouncedSearch, filterKey])

  const params: Params = { page: String(page), ...filters }
  if (debouncedSearch.trim()) params.search = debouncedSearch.trim()

  const query = useQuery({
    queryKey: [key, params],
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
  })

  return {
    rows: query.data?.results ?? [],
    total: query.data?.count ?? 0,
    pageCount: query.data ? Math.max(1, Math.ceil(query.data.count / PAGE_SIZE)) : 0,
    page,
    setPage,
    search,
    setSearch: setSearchValue,
    loading: query.isLoading,
    error: query.isError ? getErrorMessage(query.error, 'Could not load this list.') : null,
    params,
  }
}

/** Props to spread straight onto <DataTable>. */
export function tableProps<T>(list: ReturnType<typeof useList<T>>) {
  return {
    data: list.rows,
    page: list.page,
    pageCount: list.pageCount,
    total: list.total,
    onPageChange: list.setPage,
    loading: list.loading,
    error: list.error,
  }
}

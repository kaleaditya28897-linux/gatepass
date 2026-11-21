import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gatesApi, shiftsApi } from '@/api/gates'
import type { Gate, GuardShift } from '@/types'

const STORAGE_KEY = 'gatepass-guard-gate'

function readStoredGate(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export interface GuardGate {
  loading: boolean
  gates: Gate[]
  shift: GuardShift | null
  /** The gate this guard is working at, or null until one is chosen. */
  gate: Gate | null
  chooseGate: (id: number) => void
}

/**
 * Which gate the signed-in guard is posted at: a gate they picked on this
 * device wins, then their scheduled shift, then the only gate if there is just one.
 */
export function useGuardGate(): GuardGate {
  const [chosen, setChosen] = useState<number | null>(readStoredGate)
  const shiftQuery = useQuery({ queryKey: ['my-shift'], queryFn: shiftsApi.myCurrent, staleTime: 60_000 })
  const gatesQuery = useQuery({
    queryKey: ['gates', 'guard-active'],
    queryFn: () => gatesApi.list({ is_active: 'true', page_size: '100' }),
    staleTime: 60_000,
  })

  const gates = gatesQuery.data?.results ?? []
  const shift = shiftQuery.data ?? null
  const byId = (id: number | null | undefined) => gates.find((g) => g.id === id) ?? null
  const gate = byId(chosen) ?? byId(shift?.gate) ?? (gates.length === 1 ? gates[0] : null)

  const chooseGate = (id: number) => {
    setChosen(id)
    try { localStorage.setItem(STORAGE_KEY, String(id)) } catch { /* private mode */ }
  }

  return { loading: shiftQuery.isLoading || gatesQuery.isLoading, gates, shift, gate, chooseGate }
}

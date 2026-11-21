import { DoorOpen } from 'lucide-react'
import type { GuardGate } from '@/hooks/useGuardGate'
import { NativeSelect } from '@/components/ui/native-select'

export function GateSelector({ guardGate }: { guardGate: GuardGate }) {
  const { gates, gate, shift, chooseGate, loading } = guardGate
  if (loading) return null
  if (gates.length === 0) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
        No gates are open. Ask the building admin to add or open a gate before checking anyone in.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center">
      <label htmlFor="guard-gate" className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
        <DoorOpen className="h-4 w-4" /> You are at
      </label>
      <NativeSelect
        id="guard-gate"
        className="sm:max-w-xs"
        value={gate?.id ?? ''}
        onChange={(e) => chooseGate(Number(e.target.value))}
      >
        {!gate && <option value="">Choose your gate…</option>}
        {gates.map((g) => <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''}</option>)}
      </NativeSelect>
      {shift && gate && shift.gate !== gate.id && (
        <span className="text-xs text-muted-foreground">Your roster says {shift.gate_name}.</span>
      )}
      {!gate && <span className="text-sm text-destructive">Choose a gate to start checking people in.</span>}
    </div>
  )
}

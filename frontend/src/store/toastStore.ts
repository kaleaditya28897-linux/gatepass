import { create } from 'zustand'

export interface ToastMessage {
  id: number
  title: string
  variant: 'default' | 'destructive'
}

interface ToastState {
  toasts: ToastMessage[]
  push: (title: string, variant?: ToastMessage['variant']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (title, variant = 'default') =>
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id: nextId++, title, variant }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (title: string) => useToastStore.getState().push(title),
  error: (title: string) => useToastStore.getState().push(title, 'destructive'),
}

import { useToastStore } from '@/store/toastStore'
import { Toast, ToastClose, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <ToastProvider duration={5000}>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} onOpenChange={(open) => { if (!open) dismiss(t.id) }} className="p-4 pr-8">
          <ToastTitle>{t.title}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

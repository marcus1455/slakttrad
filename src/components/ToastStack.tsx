import { useEffect } from 'react'
import './ToastStack.css'

export type ToastTone = 'error' | 'success' | 'info'

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

type Props = {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), 4200)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <p>{toast.message}</p>
      <button
        type="button"
        className="toast__close"
        aria-label="Stäng"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  )
}

import { useEffect, useId, useRef } from 'react'
import { useFocusTrap } from '../lib/useFocusTrap'
import './ConfirmDialog.css'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red destructive confirm button */
  danger?: boolean
}

type Props = ConfirmOptions & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bekräfta',
  cancelLabel = 'Avbryt',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(open, cardRef)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => confirmRef.current?.focus(), 20)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="confirm-dialog" role="presentation">
      <button
        type="button"
        className="confirm-dialog__backdrop"
        aria-label="Stäng"
        onClick={onCancel}
      />
      <div
        ref={cardRef}
        className="confirm-dialog__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <p>Bekräfta</p>
          <h3 id={titleId}>{title}</h3>
        </header>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

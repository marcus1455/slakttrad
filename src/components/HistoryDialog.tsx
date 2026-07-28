import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FamilyStore } from '../types'
import {
  createCheckpoint,
  deleteCheckpoint,
  restoreCheckpoint,
} from '../lib/checkpoints'
import { useConfirm } from '../lib/confirm'
import { useFocusTrap } from '../lib/useFocusTrap'
import './HistoryDialog.css'

type Props = {
  store: FamilyStore
  onChange: (next: FamilyStore) => void
  onClose: () => void
}

export function HistoryDialog({ store, onChange, onClose }: Props) {
  const confirm = useConfirm()
  const cardRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const points = [...(store.checkpoints ?? [])].reverse()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useFocusTrap(true, cardRef)

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      onChange(createCheckpoint(store, label))
      setLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    }
  }

  const onRestore = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Återställ till ”${name}”?`,
      message: 'Nuvarande läge ersätts. Du kan ångra efteråt med Ctrl+Z.',
      confirmLabel: 'Återställ',
      danger: true,
    })
    if (!ok) return
    setError(null)
    try {
      onChange(restoreCheckpoint(store, id))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte återställa')
    }
  }

  return (
    <div className="history-dialog" role="dialog" aria-modal="true">
      <div className="history-dialog__card" ref={cardRef}>
        <header className="history-dialog__header">
          <div>
            <p>Historik</p>
            <h3>Återställningspunkter</h3>
          </div>
          <button
            type="button"
            className="history-dialog__close"
            aria-label="Stäng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="history-dialog__form" onSubmit={onSave}>
          <label>
            Namn på punkt
            <input
              value={label}
              placeholder="T.ex. Före stor uppdatering"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button type="submit">Spara punkt</button>
        </form>

        {error ? <p className="history-dialog__error">{error}</p> : null}

        <div className="history-dialog__list">
          {points.length === 0 ? (
            <p className="history-dialog__empty">Inga sparade punkter ännu.</p>
          ) : (
            points.map((point) => (
              <div key={point.id} className="history-dialog__row">
                <div>
                  <strong>{point.label}</strong>
                  <span>
                    {new Date(point.createdAt).toLocaleString('sv-SE')} ·{' '}
                    {Object.keys(point.profiles).length} personer
                  </span>
                </div>
                <div className="history-dialog__row-actions">
                  <button type="button" onClick={() => onRestore(point.id, point.label)}>
                    Återställ
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onChange(deleteCheckpoint(store, point.id))}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

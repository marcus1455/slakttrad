import { useEffect, useState, type FormEvent } from 'react'
import type { FamilyStore, Gender } from '../types'
import { addChild, addParent, addPartner } from '../lib/relations'
import './QuickAddDialog.css'

export type QuickAddKind = 'partner' | 'child' | 'parent'

type Props = {
  store: FamilyStore
  personId: string
  /** Second parent when adding a shared child from the spouse edge. */
  coParentId?: string
  kind: QuickAddKind
  onChange: (next: FamilyStore) => void
  onClose: () => void
  onCreated: (id: string) => void
}

const titles: Record<QuickAddKind, string> = {
  partner: 'Ny partner',
  child: 'Nytt barn',
  parent: 'Ny förälder',
}

export function QuickAddDialog({
  store,
  personId,
  coParentId,
  kind,
  onChange,
  onClose,
  onCreated,
}: Props) {
  const host = store.profiles[personId]
  const coParent = coParentId ? store.profiles[coParentId] : undefined
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [gender, setGender] = useState<Gender>(() => {
    if (kind === 'partner') {
      return host?.gender === 'male' ? 'female' : 'male'
    }
    return 'female'
  })
  const [error, setError] = useState<string | null>(null)

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

  if (!host) return null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const before = new Set(Object.keys(store.profiles))
      let next = store
      if (kind === 'partner') {
        next = addPartner(store, personId, { name, nickname, birthYear, gender })
      } else if (kind === 'child') {
        next = addChild(
          store,
          personId,
          { name, nickname, birthYear, gender },
          coParentId ? { coParentId } : undefined,
        )
      } else {
        next = addParent(store, personId, { name, nickname, birthYear, gender })
      }
      const createdId = Object.keys(next.profiles).find((id) => !before.has(id))
      onChange(next)
      if (createdId) onCreated(createdId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte lägga till')
    }
  }

  const childTitle =
    kind === 'child' && coParent
      ? `Nytt barn till ${host.name} och ${coParent.name}`
      : `${titles[kind]} till ${host.name}`

  return (
    <div className="quick-add" role="dialog" aria-modal="true">
      <form className="quick-add__card" onSubmit={onSubmit}>
        <header>
          <p>Lägg till</p>
          <h3>{childTitle}</h3>
        </header>
        <label>
          Namn
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Smeknamn
          <input
            value={nickname}
            placeholder="Tilltalsnamn…"
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <label>
          Födelseår
          <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
        </label>
        <label>
          Kön
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
          >
            <option value="female">Kvinna</option>
            <option value="male">Man</option>
          </select>
        </label>
        {error ? <p className="quick-add__error">{error}</p> : null}
        <div className="quick-add__actions">
          <button type="button" className="ghost" onClick={onClose}>
            Avbryt
          </button>
          <button type="submit">Lägg till</button>
        </div>
      </form>
      <button type="button" className="quick-add__backdrop" aria-label="Stäng" onClick={onClose} />
    </div>
  )
}

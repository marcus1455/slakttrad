import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { FamilyStore, Gender } from '../types'
import {
  addChild,
  addParent,
  addPartner,
  type ParentChildRelType,
  type SpouseRelType,
} from '../lib/relations'
import { useFocusTrap } from '../lib/useFocusTrap'
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
  const cardRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [spouseType, setSpouseType] = useState<SpouseRelType>('married')
  const [linkType, setLinkType] = useState<ParentChildRelType>('blood')
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

  useFocusTrap(true, cardRef)

  if (!host) return null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const before = new Set(Object.keys(store.profiles))
      let next = store
      if (kind === 'partner') {
        next = addPartner(
          store,
          personId,
          { name, birthYear, gender },
          { spouseType },
        )
      } else if (kind === 'child') {
        next = addChild(
          store,
          personId,
          { name, birthYear, gender },
          {
            ...(coParentId ? { coParentId } : {}),
            linkType,
          },
        )
      } else {
        next = addParent(store, personId, { name, birthYear, gender }, { linkType })
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
      <form className="quick-add__card" ref={cardRef} onSubmit={onSubmit}>
        <header className="quick-add__header">
          <div>
            <p>Lägg till</p>
            <h3>{childTitle}</h3>
          </div>
          <button
            type="button"
            className="quick-add__close"
            aria-label="Stäng"
            onClick={onClose}
          >
            ×
          </button>
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
        {kind === 'partner' ? (
          <label>
            Relation
            <select
              value={spouseType}
              onChange={(e) => setSpouseType(e.target.value as SpouseRelType)}
            >
              <option value="married">Gift / partner</option>
              <option value="divorced">Frånskild</option>
            </select>
          </label>
        ) : null}
        {kind === 'child' || kind === 'parent' ? (
          <label>
            Band
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as ParentChildRelType)}
            >
              <option value="blood">Blodsband</option>
              <option value="adopted">Adoption</option>
              <option value="half">Halv</option>
            </select>
          </label>
        ) : null}
        {error ? <p className="quick-add__error">{error}</p> : null}
        <div className="quick-add__actions">
          <button type="submit">Lägg till</button>
        </div>
      </form>
      <button type="button" className="quick-add__backdrop" aria-label="Stäng" onClick={onClose} />
    </div>
  )
}

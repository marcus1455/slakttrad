import { useMemo, useState } from 'react'
import type { FamilyStore } from '../types'
import { personLifeLabel } from '../lib/personLife'
import { relationToFocus } from '../lib/relationship'
import './PersonList.css'

type Props = {
  store: FamilyStore
  focusId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function PersonList({ store, focusId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(store.profiles)
      .filter((p) => {
        if (!q) return true
        const hay = [p.name, p.nickname, p.birthYear, p.occupation, p.birthPlace]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
  }, [store.profiles, query])

  return (
    <div className="person-list" role="dialog" aria-modal="true" aria-label="Personer">
      <div className="person-list__panel">
        <header className="person-list__header">
          <div>
            <p className="person-list__eyebrow">Översikt</p>
            <h2>Personer</h2>
          </div>
          <button type="button" className="person-list__close" onClick={onClose}>
            Stäng
          </button>
        </header>

        <input
          className="person-list__search"
          type="search"
          placeholder="Filtrera…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filtrera personer"
          autoFocus
        />

        <ul className="person-list__items">
          {people.map((person) => {
            const label = relationToFocus(store, person.id, focusId)
            const life = personLifeLabel(person)
            return (
              <li key={person.id}>
                <button
                  type="button"
                  className="person-list__row"
                  onClick={() => {
                    onSelect(person.id)
                    onClose()
                  }}
                >
                  {person.photoUrl ? (
                    <img className="person-list__photo" src={person.photoUrl} alt="" />
                  ) : (
                    <span className="person-list__avatar" aria-hidden>
                      {person.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="person-list__body">
                    <span className="person-list__name">
                      {person.name}
                      {person.nickname?.trim()
                        ? ` · ${person.nickname.trim()}`
                        : ''}
                    </span>
                    <span className="person-list__meta">
                      {label ? <span>{label}</span> : null}
                      {life ? <span>{life}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {people.length === 0 ? (
          <p className="person-list__empty">Inga personer matchar</p>
        ) : null}
      </div>
      <button
        type="button"
        className="person-list__backdrop"
        aria-label="Stäng"
        onClick={onClose}
      />
    </div>
  )
}

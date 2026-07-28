import { useMemo, useState } from 'react'
import type { FamilyStore } from '../types'
import { personLifeLabel } from '../lib/personLife'
import './SearchBar.css'

type Props = {
  store: FamilyStore
  onSelect: (id: string) => void
}

export function SearchBar({ store, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return Object.values(store.profiles)
      .filter((p) => {
        const hay = [
          p.name,
          p.nickname,
          p.maidenName,
          p.alsoKnownAs,
          p.birthYear,
          p.occupation,
          p.birthPlace,
          p.birthCountry,
          p.religion,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)
  }, [store.profiles, query])

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Sök person…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150)
        }}
        aria-label="Sök person"
      />
      {open && results.length > 0 ? (
        <ul className="search-bar__results">
          {results.map((person) => {
            const life = personLifeLabel(person)
            const nick = person.nickname?.trim()
            return (
            <li key={person.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(person.id)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span className="search-bar__name">
                  {person.name}
                  {nick ? ` · ${nick}` : ''}
                </span>
                <span className="search-bar__right">
                  {life ? <span className="search-bar__meta">{life}</span> : null}
                  {person.photoUrl ? (
                    <img
                      className="search-bar__photo"
                      src={person.photoUrl}
                      alt=""
                    />
                  ) : (
                    <span className="search-bar__avatar" aria-hidden>
                      {person.name.slice(0, 1)}
                    </span>
                  )}
                </span>
              </button>
            </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './PlaceInput.css'

type Props = {
  label: string
  value: string
  placeholder?: string
  readOnly?: boolean
  onChange: (value: string) => void
}

type NominatimResult = {
  place_id: number
  display_name: string
}

const DEBOUNCE_MS = 350

export function PlaceInput({
  label,
  value,
  placeholder,
  readOnly = false,
  onChange,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLLabelElement>(null)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  useEffect(() => {
    if (readOnly || value.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      setHighlight(-1)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=` +
          encodeURIComponent(value.trim())
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'sv' },
        })
        if (!res.ok) return
        const data = (await res.json()) as NominatimResult[]
        if (controller.signal.aborted) return
        setSuggestions(data)
        setOpen(data.length > 0)
        setHighlight(-1)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSuggestions([])
        setOpen(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value, readOnly])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    setSuggestions([])
    setHighlight(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setHighlight(-1)
      }
      return
    }
    if (!open || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight].display_name)
    }
  }

  return (
    <label className="place-input" ref={rootRef}>
      {label}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          highlight >= 0 ? `${listId}-${suggestions[highlight]?.place_id}` : undefined
        }
        onChange={(e) => {
          if (readOnly) return
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (!readOnly && suggestions.length > 0) setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 ? (
        <ul className="place-input__list" id={listId} role="listbox">
          {suggestions.map((item, index) => (
            <li key={item.place_id} role="presentation">
              <button
                type="button"
                id={`${listId}-${item.place_id}`}
                role="option"
                aria-selected={index === highlight}
                className={
                  index === highlight
                    ? 'place-input__option place-input__option--active'
                    : 'place-input__option'
                }
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(item.display_name)}
              >
                {item.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  )
}

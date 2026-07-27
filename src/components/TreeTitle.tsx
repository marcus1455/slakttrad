import { useEffect, useRef, useState } from 'react'
import './TreeTitle.css'

type Props = {
  name: string
  readOnly?: boolean
  onRename: (name: string) => void
}

/** Editable tree name shown in the app header. */
export function TreeTitle({ name, readOnly, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(name)
  }, [name, editing])

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  const commit = () => {
    const next = draft.trim() || 'Mitt släktträd'
    setEditing(false)
    setDraft(next)
    if (next !== name) onRename(next)
  }

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  if (readOnly) {
    return <h1 className="tree-title">{name}</h1>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="tree-title tree-title--input"
        value={draft}
        aria-label="Släktträdets namn"
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="tree-title tree-title--button"
      onClick={() => setEditing(true)}
      title="Byt namn på släktträdet"
    >
      <h1>{name}</h1>
      <span className="tree-title__hint">Byt namn</span>
    </button>
  )
}

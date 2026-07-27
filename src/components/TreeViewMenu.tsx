import { useEffect, useMemo, useRef, useState } from 'react'
import type { FamilyStore } from '../types'
import type { TreeView } from '../lib/treeView'
import { listSurnames, viewLabel } from '../lib/treeView'
import './TreeViewMenu.css'

type Props = {
  store: FamilyStore
  view: TreeView
  onChange: (view: TreeView) => void
}

export function TreeViewMenu({ store, view, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const surnames = useMemo(() => listSurnames(store), [store])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (next: TreeView) => {
    onChange(next)
    setOpen(false)
  }

  const activeLabel = viewLabel(view)

  return (
    <div className="tree-view-menu" ref={rootRef}>
      <button
        type="button"
        className={[
          'app__tool app__tool--icon',
          open ? 'app__tool--active' : '',
          view.type !== 'all' ? 'app__tool--filtered' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={`Vy: ${activeLabel}`}
        aria-label={`Trädvy: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          width="18"
          height="18"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>

      {open ? (
        <div className="tree-view-menu__panel" role="menu">
          <p className="tree-view-menu__heading">Vy</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={view.type === 'all'}
            className={view.type === 'all' ? 'is-active' : ''}
            onClick={() => select({ type: 'all' })}
          >
            Hela trädet
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={view.type === 'near'}
            className={view.type === 'near' ? 'is-active' : ''}
            onClick={() => select({ type: 'near' })}
          >
            Nära centrum
          </button>

          {surnames.length > 0 ? (
            <>
              <p className="tree-view-menu__heading">Efternamn</p>
              {surnames.map((surname) => {
                const active =
                  view.type === 'surname' && view.surname === surname
                return (
                  <button
                    key={surname}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={active ? 'is-active' : ''}
                    onClick={() => select({ type: 'surname', surname })}
                  >
                    {surname}
                  </button>
                )
              })}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

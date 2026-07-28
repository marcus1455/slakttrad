import { useEffect, useRef, useState, type ReactNode } from 'react'
import './HeaderOverflow.css'

type Props = {
  children: ReactNode
}

export function HeaderOverflow({ children }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="header-overflow" ref={rootRef}>
      <div className="header-overflow__inline">{children}</div>
      <button
        type="button"
        className="app__tool header-overflow__toggle"
        aria-label="Mer"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Mer
      </button>
      {open ? (
        <div className="header-overflow__menu" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  )
}
